
using BlazorQuestionarioServerTests;
using Microsoft.Playwright;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using VerifyXunit;
using Xunit;

namespace BlazorQuestionarioServer.Tests
{

    [Trait("Category", "Browser")]
    public class QuestionarioTest:IClassFixture<QuestionarioFixture>
    {

        QuestionarioFixture _fixture;

        public QuestionarioTest(QuestionarioFixture fixture)
        {
            this._fixture = fixture;
        }

        [Fact]
        public async Task IndexPageFirefox()
        {
            var page = await this._fixture.Setup(false);

            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);


            await Verifier.Verify(page, this._fixture.VerifySettings);
        }

        [Fact]
        public async Task IndexPageChrome()
        {
            var page = await this._fixture.Setup(true);

            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);


            await Verifier.Verify(page, this._fixture.VerifySettings);
        }
        //[Fact]
        //public async Task TestInvioSenzaMettereMailChrome()
        //{
        //    var page = await this.fixture.Setup(true);

        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        //    await page.Locator("#txtNome").FillAsync("gpt");
            
        //    await page.Locator("text=Salva").ClickAsync();
        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

        //    await Verifier.Verify(page, this.fixture.VerifySettings);
        //}
        //[Fact]
        //public async Task TestInvioSenzaMettereMailFirefox()
        //{
        //    var page = await this.fixture.Setup(false);

        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        //    await page.Locator("#txtNome").FillAsync("gpt");

        //    await page.Locator("text=Salva").ClickAsync();
        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

        //    await Verifier.Verify(page, this.fixture.VerifySettings);
        //}
        //[Fact]
        //public async Task TestCifraNegatuvaValutazioneChrome()
        //{
        //    var page = await this.fixture.Setup(false);

        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            
            
            
        //    await page.Locator("#txtNome").FillAsync("gpt");
        //    await page.Locator("#intUtilitaInformazioniRicevute").FillAsync("-1");
        //    await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            
        //    await Verifier.Verify(page, this.fixture.VerifySettings);
        //}
    }
}
