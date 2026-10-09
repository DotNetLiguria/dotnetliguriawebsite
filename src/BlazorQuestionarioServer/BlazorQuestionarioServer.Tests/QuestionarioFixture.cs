using AngleSharp.Diffing;
using AngleSharp.Diffing.Core;
using BlazorQuestionarioServer.Tests;
using Microsoft.Playwright;
using System;
using System.Threading.Tasks;
using VerifyTests;
using VerifyXunit;
using Xunit;
namespace BlazorQuestionarioServerTests
{
    public class QuestionarioFixture : IAsyncLifetime
    {

        IPlaywright? _playwright;
        VerifySettings _verifierSettings = null!;
        IBrowser? _firefoxBrowser;
        IBrowser? _chromeBrowser;
        string _baseUrl = string.Empty;
        public VerifySettings VerifySettings { get => _verifierSettings!; }
        public async Task DisposeAsync()
        {
            try
            {
                if (_firefoxBrowser != null) await _firefoxBrowser.DisposeAsync();
            }
            finally
            {
                try
                {
                    if (_chromeBrowser != null) await _chromeBrowser.DisposeAsync();
                }
                finally
                {
                    _playwright?.Dispose();
                    _playwright = null;
                    _firefoxBrowser = null;
                    _chromeBrowser = null;
                }
            }
        }

        public async Task InitializeAsync()
        {
            var configuredUrl = Environment.GetEnvironmentVariable("QUESTIONNAIRE_TEST_BASE_URL");
            if (!Uri.TryCreate(configuredUrl, UriKind.Absolute, out var baseUri) ||
                (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException("Set QUESTIONNAIRE_TEST_BASE_URL to an explicitly provisioned disposable application URL.");
            }
            _baseUrl = baseUri.AbsoluteUri;

            try
            {
                _playwright = await Playwright.CreateAsync();
                _firefoxBrowser = await _playwright.Firefox.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
                _chromeBrowser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });


            VerifyPlaywright.Enable();
            VerifyAngleSharpDiffing.Initialize();

            _verifierSettings = new VerifySettings();
            _verifierSettings.UseDirectory("DirTest");
            _verifierSettings.ScrubInlineGuids();
            _verifierSettings.AngleSharpDiffingSettings(
                action =>
                {
                    static FilterDecision ScriptFilter(
                        in ComparisonSource source,
                        FilterDecision decision)
                    {
                        if (source.Node.NodeName == "SCRIPT")
                        {
                            return FilterDecision.Exclude;
                        }

                        return decision;
                    }

                    var options = action.AddDefaultOptions();
                    options.AddFilter(ScriptFilter);
                });
            }
            catch
            {
                await DisposeAsync();
                throw;
            }
        }

        public async Task<IPage> Setup(bool ChromeBrowser,string language = "it-IT"  )
        {
            var browser = (ChromeBrowser ? _chromeBrowser : _firefoxBrowser)
                ?? throw new InvalidOperationException("The browser fixture is not initialized.");
            var context = await browser.NewContextAsync(new BrowserNewContextOptions
            {
                Locale = language,
                IgnoreHTTPSErrors=true
            });
            try
            {
                var page = await context.NewPageAsync();
                await page.GotoAsync(_baseUrl);
                await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
                return page;
            }
            catch
            {
                await context.DisposeAsync();
                throw;
            }
        }

    }
}
