#!/bin/sh
set -eu

input_file=${1:?Usage: provision-dotnetliguria-config.sh <input-file> [target-directory]}
target_directory=${2:-/docker_data/global_secrets/dotnetliguria}
parent_directory=$(dirname "$target_directory")

is_allowed_key() {
    case "$1" in
        AuthServer__ClientSecret|AuthServer__ClientId|Privacy__ProtectedStorageApproved|Privacy__IdentityAttributePermissionsApproved|Privacy__AdminClientSecret|Privacy__AdminClientId|PermissionDirectory__ServiceClientSecret|PermissionDirectory__ServiceClientId|PermissionDirectory__ProtectedGroupIds__0|PermissionDirectory__ProtectedGroupIds__1|PermissionDirectory__Issuer|PermissionDirectory__InvitationRedirectUri|PermissionDirectory__InvitationClientId|PermissionDirectory__InvitationLifespanSeconds|PermissionDirectory__BoardGroupId|PermissionDirectory__ApplicationClientId|PermissionDirectory__AllowedInvitationRedirectUris__0|PermissionDirectory__AllowedIdentityHost|Newsletters__SmtpHost|Newsletters__SmtpPort|Newsletters__SmtpUseStartTls|Newsletters__SmtpUserName|Newsletters__SmtpPassword|Newsletters__SenderAddress|Newsletters__DefaultTestAddress|Eventbrite__PrivateToken|Eventbrite__AccessToken|Eventbrite__OrganizationId|Eventbrite__OrganizerId|Kestrel__Endpoints__Https__Certificate__Password)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

requires_value() {
    case "$1" in
        Newsletters__DefaultTestAddress|Newsletters__SmtpUserName|Newsletters__SmtpPassword)
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

required_keys='
AuthServer__ClientSecret
AuthServer__ClientId
Privacy__ProtectedStorageApproved
Privacy__IdentityAttributePermissionsApproved
Privacy__AdminClientSecret
Privacy__AdminClientId
PermissionDirectory__ServiceClientSecret
PermissionDirectory__ServiceClientId
PermissionDirectory__ProtectedGroupIds__0
PermissionDirectory__ProtectedGroupIds__1
PermissionDirectory__Issuer
PermissionDirectory__InvitationRedirectUri
PermissionDirectory__InvitationClientId
PermissionDirectory__InvitationLifespanSeconds
PermissionDirectory__BoardGroupId
PermissionDirectory__ApplicationClientId
PermissionDirectory__AllowedInvitationRedirectUris__0
PermissionDirectory__AllowedIdentityHost
Newsletters__SmtpHost
Newsletters__SmtpPort
Newsletters__SmtpUseStartTls
Newsletters__SmtpUserName
Newsletters__SmtpPassword
Newsletters__SenderAddress
Newsletters__DefaultTestAddress
'

optional_keys='
Eventbrite__PrivateToken
Eventbrite__AccessToken
Eventbrite__OrganizationId
Eventbrite__OrganizerId
Kestrel__Endpoints__Https__Certificate__Password
'

if [ ! -f "$input_file" ]; then
    printf '%s\n' "Configuration input file does not exist: $input_file" >&2
    exit 1
fi

umask 077
mkdir -p "$parent_directory"
temporary_directory=$(mktemp -d "$parent_directory/.dotnetliguria-config.XXXXXX")
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM
carriage_return=$(printf '\r')

while IFS= read -r line || [ -n "$line" ]; do
    line=${line%"$carriage_return"}
    case "$line" in
        ''|\#*)
            continue
            ;;
        *=*)
            key=${line%%=*}
            value=${line#*=}
            ;;
        *)
            printf '%s\n' "Invalid configuration entry. Expected KEY=value." >&2
            exit 1
            ;;
    esac

    if ! is_allowed_key "$key"; then
        printf '%s\n' "Unsupported configuration key: $key" >&2
        exit 1
    fi
    if requires_value "$key"; then
        case "$value" in
            *[![:space:]]*) ;;
            *)
                printf '%s\n' "Configuration key $key must not be empty." >&2
                exit 1
                ;;
        esac
    fi
    if [ -e "$temporary_directory/$key" ]; then
        printf '%s\n' "Duplicate configuration key: $key" >&2
        exit 1
    fi

    printf '%s' "$value" > "$temporary_directory/$key"
done < "$input_file"

for key in $required_keys; do
    if [ ! -f "$temporary_directory/$key" ]; then
        printf '%s\n' "Missing required configuration key: $key" >&2
        exit 1
    fi
done

if [ -e "$target_directory" ] && [ ! -d "$target_directory" ]; then
    printf '%s\n' "Configuration target is not a directory: $target_directory" >&2
    exit 1
fi

mkdir -p "$target_directory"
chown 10000:10000 "$target_directory"
chmod 700 "$target_directory"
for key in $required_keys; do
    install -m 600 "$temporary_directory/$key" "$target_directory/.$key.tmp"
    mv -f "$target_directory/.$key.tmp" "$target_directory/$key"
    chown 10000:10000 "$target_directory/$key"
done

for key in $optional_keys; do
    if [ -f "$temporary_directory/$key" ]; then
        install -m 600 "$temporary_directory/$key" "$target_directory/.$key.tmp"
        mv -f "$target_directory/.$key.tmp" "$target_directory/$key"
        chown 10000:10000 "$target_directory/$key"
    else
        rm -f "$target_directory/$key"
    fi
done

printf '%s\n' "Provisioned key-per-file settings at $target_directory."
