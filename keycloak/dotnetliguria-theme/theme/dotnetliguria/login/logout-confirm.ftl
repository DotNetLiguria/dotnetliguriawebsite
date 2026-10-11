<#--
  DotNetLiguria: replaces keycloak base login logout-confirm.ftl (Keycloak 26.6.3). Change, marked "DNL":
  the buttons use the v2 button macros (green "Esci", outlined "Torna al sito") instead of the
  PatternFly 3 classes of the base page. The form fields and ids are the upstream ones.
-->
<#import "template.ftl" as layout>
<#import "buttons.ftl" as buttons>
<@layout.registrationLayout; section>
    <#if section = "header">
        ${msg("logoutConfirmTitle")}
    <#elseif section = "form">
        <div id="kc-logout-confirm" class="content-area">
            <p class="instruction">${msg("logoutConfirmHeader")}</p>

            <form class="form-actions" action="${url.logoutConfirmAction}" onsubmit="confirmLogout.disabled = true; return true;" method="POST">
                <input type="hidden" name="session_code" value="${logoutConfirm.code}">
                <#-- DNL: macro buttons -->
                <@buttons.actionGroup>
                    <@buttons.button id="kc-logout" name="confirmLogout" label="doLogout" class=["kcButtonPrimaryClass", "kcButtonBlockClass"] />
                    <#if !logoutConfirm.skipLink && (client.baseUrl)?has_content>
                        <@buttons.buttonLink id="kc-back-to-application" href=client.baseUrl label="backToApplication" class=["kcButtonSecondaryClass", "kcButtonBlockClass"] />
                    </#if>
                </@buttons.actionGroup>
            </form>
        </div>
    </#if>
</@layout.registrationLayout>
