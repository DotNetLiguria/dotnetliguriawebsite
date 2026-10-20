#requires -Version 7.4
[CmdletBinding()]
param(
    [ValidateSet('Preview', 'Apply')][string]$Mode = 'Preview',
    [string]$DatabaseName = 'DotNetLiguria',
    [string]$BoardCollection = 'Board',
    [string]$SpeakerCollection = 'Speaker'
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:DOTNET_LIGURIA_PROFILE_MONGODB_URI)) {
    throw 'Supply DOTNET_LIGURIA_PROFILE_MONGODB_URI through a protected environment variable.'
}
$mongosh = (Get-Command mongosh -ErrorAction Stop).Source
$previous = $env:DOTNET_LIGURIA_PROFILE_INDEX_CONFIG
try {
    $env:DOTNET_LIGURIA_PROFILE_INDEX_CONFIG = @{
        database = $DatabaseName
        collections = @($BoardCollection, $SpeakerCollection)
        apply = $Mode -eq 'Apply'
    } | ConvertTo-Json -Compress
    $javascript = @'
try {
    const config = JSON.parse(process.env.DOTNET_LIGURIA_PROFILE_INDEX_CONFIG);
    const database = new Mongo(process.env.DOTNET_LIGURIA_PROFILE_MONGODB_URI).getDB(config.database);
    const key = { AccountIssuer: 1, AccountSubject: 1 };
    const partial = { AccountIssuer: { $type: "string" }, AccountSubject: { $type: "string" } };
    const plans = config.collections.map(name => {
        const collection = database.getCollection(name);
        const duplicates = collection.aggregate([
            { $match: partial },
            { $group: { _id: { issuer: "$AccountIssuer", subject: "$AccountSubject" }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $count: "count" }
        ]).toArray()[0]?.count ?? 0;
        const incomplete = collection.countDocuments({
            $or: [
                { AccountIssuer: { $type: "string" }, AccountSubject: { $not: { $type: "string" } } },
                { AccountSubject: { $type: "string" }, AccountIssuer: { $not: { $type: "string" } } },
                { AccountIssuer: "" }, { AccountSubject: "" }
            ]
        });
        const exists = database.getCollectionNames().includes(name);
        const ready = exists && collection.getIndexes().some(index =>
            index.unique === true &&
            JSON.stringify(index.key) === JSON.stringify(key) &&
            JSON.stringify(index.partialFilterExpression) === JSON.stringify(partial) &&
            (!index.collation || index.collation.locale === "simple"));
        return { name, duplicates, incomplete, ready };
    });
    printjson({ mode: config.apply ? "Apply" : "Preview", collections: plans });
    if (plans.some(plan => plan.duplicates || plan.incomplete))
        throw new Error("profile_account_inventory_requires_review");
    if (config.apply) {
        for (const plan of plans.filter(plan => !plan.ready))
            database.getCollection(plan.name).createIndex(key, {
                name: "uq_profile_account", unique: true,
                partialFilterExpression: partial, collation: { locale: "simple" }
            });
        printjson({ status: "indexes_applied" });
    }
} catch {
    printjson({ status: "failed", code: "profile_account_index_setup_failed" });
    quit(1);
}
'@
    & $mongosh --quiet --nodb --eval $javascript
    if ($LASTEXITCODE -ne 0) { throw 'Profile account index setup failed; inspect the sanitized inventory result.' }
}
finally {
    $env:DOTNET_LIGURIA_PROFILE_INDEX_CONFIG = $previous
}
