using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Net;
using Ganss.Xss;
using Markdig;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;
using AngleSharp.Html.Parser;
using DotNetLiguriaCore.Storage;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterRenderer
{
    public const string Version = "1";
    private readonly INewsletterStore _store;
    private readonly IOptionsMonitor<NewsletterOptions> _options;
    private readonly string _contentsRoot;
    private readonly TimeProvider _clock;
    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder().DisableHtml().UseAdvancedExtensions().Build();

    public NewsletterRenderer(INewsletterStore store, IOptionsMonitor<NewsletterOptions> options,
        IWebHostEnvironment environment, TimeProvider clock, WebsiteStoragePaths? storagePaths = null)
    {
        _store = store;
        _options = options;
        _contentsRoot = storagePaths?.ContentsRoot ?? WebsiteStoragePaths.ResolveContentsRoot(environment);
        _clock = clock;
    }

    public async Task<NewsletterSnapshotDocument> PrepareAsync(NewsletterDocument newsletter,
        CancellationToken cancellationToken)
    {
        ValidateSubject(newsletter.Subject);
        var options = _options.CurrentValue;
        if (string.IsNullOrWhiteSpace(newsletter.Markdown) || newsletter.Markdown.Length > 100_000)
            throw new NewsletterServiceException("invalid_newsletter_markdown", 400);
        if (newsletter.Markdown.Contains("{{", StringComparison.Ordinal) ||
            newsletter.Markdown.Contains("}}", StringComparison.Ordinal))
            throw new NewsletterServiceException("unresolved_template_placeholder", 400);
        var rendered = Markdown.ToHtml(newsletter.Markdown, _pipeline);
        var images = new Dictionary<Guid, NewsletterImageDocument>();
        var html = await ReplaceImagesAsync(rendered, images, cancellationToken);
        html = Sanitize(html);

        var logoPath = Path.Combine(_contentsRoot, "newsletters", "dotnetliguria-logo.png");
        if (!File.Exists(logoPath))
            throw new NewsletterServiceException("newsletter_logo_unavailable", 503);
        var logo = await File.ReadAllBytesAsync(logoPath, cancellationToken);
        var embedded = new List<NewsletterSnapshotImage>
        {
            new()
            {
                Cid = "dotnetliguria-logo",
                ContentType = "image/png",
                Data = logo,
                Digest = Convert.ToHexString(SHA256.HashData(logo))
            }
        };
        embedded.AddRange(images.Values.Select(image => new NewsletterSnapshotImage
        {
            Cid = image.Id.ToString("N") + "@newsletter",
            ContentType = image.ContentType,
            Data = image.Data,
            Digest = image.Digest
        }));

        var safeBody = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse\">" +
            "<tr><td align=\"center\"><table role=\"presentation\" width=\"680\" cellpadding=\"0\" cellspacing=\"0\" " +
            "style=\"width:100%;max-width:680px;font-family:Arial,Helvetica,sans-serif;color:#202124;line-height:1.55\">" +
            "<tr><td style=\"padding:24px\"><img src=\"cid:dotnetliguria-logo\" alt=\"DotNetLiguria\" width=\"180\" " +
            "style=\"display:block;width:180px;height:auto;border:0\"></td></tr>" +
            $"<tr><td style=\"padding:0 24px 24px\">{html}</td></tr></table></td></tr></table>";
        var plainText = ToPlainText(html);
        var fingerprint = ConfigurationFingerprint(options, embedded[0].Digest);
        var hashMaterial = string.Join("\n", Version, newsletter.Subject, safeBody, plainText, fingerprint,
            string.Join("|", embedded.Select(image => image.Digest)));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(hashMaterial)));
        var snapshot = new NewsletterSnapshotDocument
        {
            Id = Guid.NewGuid(),
            NewsletterId = newsletter.Id,
            NewsletterVersion = newsletter.Version,
            ContentHash = hash,
            Subject = newsletter.Subject,
            Html = safeBody,
            PlainText = plainText,
            Images = embedded,
            LogoDigest = embedded[0].Digest,
            ConfigurationFingerprint = fingerprint,
            RendererVersion = Version,
            CreatedAt = _clock.GetUtcNow()
        };
        var measurementOptions = new NewsletterOptions
        {
            SenderAddress = NewsletterOptions.IsMailbox(options.SenderAddress)
                ? options.SenderAddress : "newsletter@example.invalid",
            SenderName = options.SenderName
        };
        using var message = BuildMessage(snapshot, measurementOptions,
            NewsletterOptions.IsMailbox(options.DefaultTestAddress)
                ? options.DefaultTestAddress : "preview@example.invalid", true, null);
        using var stream = new MemoryStream();
        await message.WriteToAsync(stream, cancellationToken);
        if (stream.Length > Math.Clamp(options.MaxMimeBytes, 65_536, 10 * 1024 * 1024))
            throw new NewsletterServiceException("newsletter_mime_too_large", 400);
        snapshot.MessageBytes = checked((int)stream.Length);
        return snapshot;
    }

    public static MimeMessage BuildMessage(NewsletterSnapshotDocument snapshot, NewsletterOptions options,
        string recipient, bool test, string? messageId)
    {
        if (!NewsletterOptions.IsMailbox(recipient) || !NewsletterOptions.IsMailbox(options.SenderAddress))
            throw new NewsletterServiceException("invalid_mail_address", 400);
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.SenderName, options.SenderAddress));
        message.To.Add(MailboxAddress.Parse(recipient));
        if (NewsletterOptions.IsMailbox(options.ReplyToAddress))
            message.ReplyTo.Add(MailboxAddress.Parse(options.ReplyToAddress));
        message.Subject = test ? $"[TEST] {snapshot.Subject}" : snapshot.Subject;
        if (messageId is not null) message.MessageId = messageId;
        var builder = new BodyBuilder { TextBody = snapshot.PlainText, HtmlBody = snapshot.Html };
        foreach (var image in snapshot.Images)
        {
            var resource = builder.LinkedResources.Add(image.Cid, new MemoryStream(image.Data),
                ContentType.Parse(image.ContentType));
            resource.ContentId = image.Cid;
            resource.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);
        }
        message.Body = builder.ToMessageBody();
        return message;
    }

    public string ConfigurationFingerprint()
    {
        var options = _options.CurrentValue;
        var logoPath = Path.Combine(_contentsRoot, "newsletters", "dotnetliguria-logo.png");
        if (!File.Exists(logoPath))
            throw new NewsletterServiceException("newsletter_logo_unavailable", 503);
        var logoDigest = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(logoPath)));
        return ConfigurationFingerprint(options, logoDigest);
    }

    private static string ConfigurationFingerprint(NewsletterOptions options, string logoDigest)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            string.Join("|", Version, logoDigest, options.SenderAddress.Trim().ToLowerInvariant(),
                options.DistributionAddress.Trim().ToLowerInvariant(), options.SenderName,
                options.ReplyToAddress.Trim().ToLowerInvariant(), options.ActivationGeneration,
                options.PublicBaseUrl.TrimEnd('/'), options.SmtpHost.Trim().ToLowerInvariant(),
                options.SmtpPort, options.SmtpUseStartTls, options.TestEnabled, options.ProductionEnabled,
                Math.Clamp(options.MaxMimeBytes, 65_536, 10 * 1024 * 1024),
                string.Join(",", (options.DistributionAliases ?? []).OrderBy(alias => alias, StringComparer.OrdinalIgnoreCase)
                    .Select(alias => alias.Trim().ToLowerInvariant()))))));
    }

    private async Task<string> ReplaceImagesAsync(string html, Dictionary<Guid, NewsletterImageDocument> images,
        CancellationToken cancellationToken)
    {
        using var document = new HtmlParser().ParseDocument(html);
        var elements = document.QuerySelectorAll("img");
        if (elements.Length > Math.Clamp(_options.CurrentValue.MaxImages, 1, 8))
            throw new NewsletterServiceException("newsletter_image_count_exceeded", 400);
        foreach (var element in elements)
        {
            var source = element.GetAttribute("src") ?? "";
            const string prefix = "newsletter-image:";
            if (!source.StartsWith(prefix, StringComparison.Ordinal) ||
                !Guid.TryParse(source[prefix.Length..], out var id))
                throw new NewsletterServiceException("remote_images_not_allowed", 400);
            var image = await _store.GetImageAsync(id, cancellationToken);
            if (image is null)
                throw new NewsletterServiceException("newsletter_image_not_found", 400);
            if (image.ContentType is not ("image/png" or "image/jpeg") ||
                image.Data.Length is 0 or > NewsletterImageProcessor.MaximumInputBytes ||
                Convert.ToHexString(SHA256.HashData(image.Data)) != image.Digest)
                throw new NewsletterServiceException("newsletter_image_integrity_failed", 409);
            if (!images.ContainsKey(id)) images.Add(id, image);
            var cid = id.ToString("N") + "@newsletter";
            element.SetAttribute("src", "cid:" + cid);
        }
        foreach (var link in document.QuerySelectorAll("a[href]"))
        {
            var href = link.GetAttribute("href") ?? "";
            if (!Uri.TryCreate(href, UriKind.Absolute, out var uri) ||
                uri.Scheme is not ("https" or "http" or "mailto") || !string.IsNullOrEmpty(uri.UserInfo))
                throw new NewsletterServiceException("unsafe_newsletter_link", 400);
        }
        return document.Body!.InnerHtml;
    }

    public static async Task<int> GetMessageBytesAsync(MimeMessage message, CancellationToken cancellationToken)
    {
        await using var stream = new MemoryStream();
        await message.WriteToAsync(stream, cancellationToken);
        return checked((int)stream.Length);
    }

    private static string Sanitize(string html)
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        sanitizer.AllowedTags.UnionWith(["a", "blockquote", "br", "code", "em", "h1", "h2", "h3",
            "h4", "h5", "h6", "hr", "img", "li", "ol", "p", "pre", "strong", "table", "tbody",
            "td", "th", "thead", "tr", "ul"]);
        sanitizer.AllowedAttributes.Clear();
        sanitizer.AllowedAttributes.UnionWith(["alt", "href", "src", "title"]);
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.UnionWith(["https", "http", "mailto", "cid"]);
        var safe = sanitizer.Sanitize(html);
        if (Regex.IsMatch(safe, @"<img\b[^>]*src=[\""'](?:https?:|//|data:)", RegexOptions.IgnoreCase))
            throw new NewsletterServiceException("remote_images_not_allowed", 400);
        return safe;
    }

    private static string ToPlainText(string html)
    {
        var withLinks = Regex.Replace(html, "<a\\b[^>]*href=[\"'](?<url>[^\"']+)[\"'][^>]*>(?<text>.*?)</a>",
            "${text} (${url})", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        withLinks = Regex.Replace(withLinks, "</(p|div|h[1-6]|li|tr|blockquote)>", Environment.NewLine,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return WebUtility.HtmlDecode(Regex.Replace(withLinks, "<[^>]+>", " ",
            RegexOptions.CultureInvariant)).Trim();
    }

    private static void ValidateSubject(string subject)
    {
        if (string.IsNullOrWhiteSpace(subject) || subject.Length > 200 ||
            subject.Any(char.IsControl))
            throw new NewsletterServiceException("invalid_subject", 400);
    }
}
