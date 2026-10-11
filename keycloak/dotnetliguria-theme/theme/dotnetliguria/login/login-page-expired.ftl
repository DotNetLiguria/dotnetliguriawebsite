<#--
  DotNetLiguria: replaces keycloak base login-page-expired.ftl (Keycloak 26.6.3). The upstream page
  has two links that both read "click here", which does not tell a screen reader user anything;
  here the two actions are named buttons, the first one being the safe choice (restart).
  Element ids are the upstream ones.
-->
<#import "template.ftl" as layout>
<#import "buttons.ftl" as buttons>
<@layout.registrationLayout; section>
    <#if section = "header">
        ${msg("pageExpiredTitle")}
    <#elseif section = "form">
        <p id="instruction1" class="instruction">${msg("dnlPageExpiredIntro")}</p>
        <@buttons.actionGroup>
            <@buttons.buttonLink id="loginRestartLink" href=url.loginRestartFlowUrl label="dnlPageExpiredRestart" class=["kcButtonPrimaryClass", "kcButtonBlockClass"] />
            <@buttons.buttonLink id="loginContinueLink" href=url.loginAction label="dnlPageExpiredContinue" class=["kcButtonSecondaryClass", "kcButtonBlockClass"] />
        </@buttons.actionGroup>
    </#if>
</@layout.registrationLayout>
