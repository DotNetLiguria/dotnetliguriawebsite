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

        IPlaywright playwright;
        VerifySettings verifierSettings;
        IBrowser firefoxBrowser;
        IBrowser chromeBrowser;
        string baseUrl = "https://localhost:64897";
        public VerifySettings VerifySettings { get => verifierSettings!; }
        public async Task DisposeAsync()
        {
            await firefoxBrowser.DisposeAsync();
            await chromeBrowser.DisposeAsync();
            playwright.Dispose();
        }

        public async Task InitializeAsync()
        {
            Console.WriteLine("Creating Playwright");
            playwright = await Playwright.CreateAsync();
            firefoxBrowser = await playwright.Firefox.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = false,
                SlowMo = 50
            });

            chromeBrowser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = false,
                SlowMo = 50
            });


            VerifyPlaywright.Enable();
            VerifyAngleSharpDiffing.Initialize();

            verifierSettings = new VerifySettings();
            verifierSettings.UseDirectory("DirTest");
            verifierSettings.ScrubInlineGuids();
            verifierSettings.AngleSharpDiffingSettings(
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

        public async Task<IPage> Setup(bool ChromeBrowser,string language = "it-IT"  )
        {
            
            IPage page = null;
            IBrowser browser;

            if (ChromeBrowser)
            {
                browser = chromeBrowser;
            }
            else
            {
                browser = firefoxBrowser;
            }
            var context = await browser.NewContextAsync(new BrowserNewContextOptions
            {
                Locale = language,
                IgnoreHTTPSErrors=true
            });

            page = await context.NewPageAsync();
            
            
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            await page.GotoAsync(baseUrl);

            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            return page;
        }

    }
}
