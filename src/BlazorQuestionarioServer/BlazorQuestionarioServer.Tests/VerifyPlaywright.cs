using Microsoft.Playwright;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using VerifyTests;

namespace BlazorQuestionarioServer.Tests
{
    public static class VerifyPlaywright
    {
        public static void Enable()
        {
            VerifierSettings.RegisterFileConverter<IPage>(PageToImage);
            VerifierSettings.RegisterFileConverter<IElementHandle>(ElementToImage);
        }

        static async Task<ConversionResult> PageToImage(IPage page, IReadOnlyDictionary<string, object> context)
        {
            var html = page.ContentAsync();
            return new(
                null,
                new List<Target>
                {
                    new Target("html", await html)
                }
            );
        }

        static async Task<ConversionResult> ElementToImage(IElementHandle element, IReadOnlyDictionary<string, object> context)
        {
            var html = element.InnerHTMLAsync();
            return new(
                null,
                new List<Target>
                {
                    new Target("html", await html)
                }
            );
        }
    }
}
