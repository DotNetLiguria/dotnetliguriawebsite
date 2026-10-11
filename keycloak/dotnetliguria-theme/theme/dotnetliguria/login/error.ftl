<#--
  DotNetLiguria: replaces keycloak base login error.ftl (Keycloak 26.6.3). Change, marked "DNL":
  the way back is a button, not a bare link. The element ids are the upstream ones.
-->
<#import "template.ftl" as layout>
<#import "buttons.ftl" as buttons>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${kcSanitize(msg("errorTitle"))?no_esc}
    <#elseif section = "form">
        <div id="kc-error-message">
            <p class="instruction">${kcSanitize(message.summary)?no_esc}</p>
            <#if traceId??>
                <p class="instruction" id="traceId">${msg("traceIdSupportMessage", traceId)}</p>
            </#if>
            <#if skipLink??>
            <#else>
                <#if client?? && client.baseUrl?has_content>
                    <#-- DNL: button -->
                    <@buttons.actionGroup>
                        <@buttons.buttonLink id="backToApplication" href=client.baseUrl label="backToApplication" class=["kcButtonSecondaryClass", "kcButtonBlockClass"] />
                    </@buttons.actionGroup>
                </#if>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
