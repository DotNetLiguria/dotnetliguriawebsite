<#--
  DotNetLiguria: replaces keycloak base login info.ftl (Keycloak 26.6.3). Changes, all marked "DNL":
  the follow-up link is a button, and the summary is not written twice when it is already the
  title of the page (the upstream page repeats it, e.g. "You are logged out" / "You are logged out").
-->
<#import "template.ftl" as layout>
<#import "buttons.ftl" as buttons>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${message.summary}
        </#if>
    <#elseif section = "form">
    <div id="kc-info-message">
        <#-- DNL: only when it adds something to the title -->
        <#if messageHeader?? || requiredActions??>
        <p class="instruction">${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list><#else></#if></p>
        </#if>
        <#if skipLink??>
        <#else>
            <#-- DNL: buttons instead of bare links -->
            <#if pageRedirectUri?has_content>
                <@buttons.actionGroup>
                    <@buttons.buttonLink href=pageRedirectUri label="backToApplication" class=["kcButtonSecondaryClass", "kcButtonBlockClass"] />
                </@buttons.actionGroup>
            <#elseif actionUri?has_content>
                <@buttons.actionGroup>
                    <@buttons.buttonLink href=actionUri label="proceedWithAction" class=["kcButtonPrimaryClass", "kcButtonBlockClass"] />
                </@buttons.actionGroup>
            <#elseif (client.baseUrl)?has_content>
                <@buttons.actionGroup>
                    <@buttons.buttonLink href=client.baseUrl label="backToApplication" class=["kcButtonSecondaryClass", "kcButtonBlockClass"] />
                </@buttons.actionGroup>
            </#if>
        </#if>
    </div>
    </#if>
</@layout.registrationLayout>
