<#--
  DotNetLiguria page frame.

  Copy of keycloak.v2/login/template.ftl (Keycloak 26.6.3) with these changes, all marked "DNL":
    1. the header is the historic DotNetLiguria logo (white lettering) instead of the realm name,
       with the language switch next to it (it used to sit in the card header);
    2. a decorative copy of the site's cyan arc sits behind the page;
    3. feedback messages are announced to screen readers (role="alert" for errors and
       warnings, role="status" otherwise), their icon is hidden and their type is spelled out;
    4. the read-only username of the second login step has an accessible name.
  Everything else is upstream. When Keycloak is upgraded, compare with keycloak/check-upstream.sh.
-->
<#import "field.ftl" as field>
<#import "footer.ftl" as loginFooter>
<#macro username>
  <#assign label>
    <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
  </#assign>
  <@field.group name="username" label=label>
    <div class="${properties.kcInputGroup}">
      <div class="${properties.kcInputGroupItemClass} ${properties.kcFill}">
        <span class="${properties.kcInputClass} ${properties.kcFormReadOnlyClass}">
          <#-- DNL: aria-label (upstream: the <label for="username"> of the group points at an id this input does not have) -->
          <input id="kc-attempted-username" value="${auth.attemptedUsername}" aria-label="${label?markup_string?trim}" readonly>
        </span>
      </div>
      <div class="${properties.kcInputGroupItemClass}">
        <button id="reset-login" class="${properties.kcFormPasswordVisibilityButtonClass} kc-login-tooltip" type="button"
              aria-label="${msg('restartLoginTooltip')}" onclick="location.href='${url.loginRestartFlowUrl}'">
            <i class="fa-sync-alt fas" aria-hidden="true"></i>
            <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
        </button>
      </div>
    </div>
  </@field.group>
</#macro>

<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="color-scheme" content="light${darkMode?then(' dark', '')}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <#-- DNL: colour of the browser bar on phones -->
    <meta name="theme-color" content="#083d73">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${title!}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <#if darkMode>
      <script type="module" async blocking="render">
          <#outputformat "JavaScript">
          const DARK_MODE_CLASS = ${properties.kcDarkModeClass?c};
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

          updateDarkMode(mediaQuery.matches);
          mediaQuery.addEventListener("change", (event) => updateDarkMode(event.matches));

          function updateDarkMode(isEnabled) {
            const { classList } = document.documentElement;

            if (isEnabled) {
              classList.add(DARK_MODE_CLASS);
            } else {
              classList.remove(DARK_MODE_CLASS);
            }
          }
          </#outputformat>
      </script>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    <script type="module">
        <#outputformat "JavaScript">
        import { startSessionPolling } from ${(url.resourcesPath + "/js/authChecker.js")?c};

        startSessionPolling(
            ${url.ssoLoginInOtherTabsUrl?c}
        );
        </#outputformat>
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");

            if (!link) {
                return;
            }

            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }

            const { disabledClass } = link.dataset;

            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }

            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
             <#outputformat "JavaScript">
            import { checkAuthSession } from ${(url.resourcesPath + "/js/authChecker.js")?c};

            checkAuthSession(
                ${authenticationSession.authSessionIdHash?c}
            );
            </#outputformat>
        </script>
    </#if>
    <script>
      // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1404468
      const isFirefox = true;
    </script>
</head>

<body id="keycloak-bg" class="${properties.kcBodyClass!}" data-page-id="login-${pageId}">
<#-- DNL: the cyan arc of the logo and of the home page hero, drawn once (not animated with reduced motion). -->
<svg class="dnl-arc" viewBox="0 0 1200 420" fill="none" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <g class="dnl-arc-draw" stroke-linecap="round">
    <path d="M-60 430 C 380 420, 860 230, 1260 40" stroke="#00A8DF" stroke-width="34" opacity="0.6" />
    <path d="M-40 455 C 400 445, 880 265, 1270 80" stroke="#8FD3EC" stroke-width="8" opacity="0.5" />
  </g>
</svg>
<div class="${properties.kcLogin!}">
  <div class="${properties.kcLoginContainer!}">
    <#-- DNL: logo instead of the realm name. The name stays available as the alternative text. -->
    <header id="kc-header" class="pf-v5-c-login__header dnl-header">
      <#assign dnlLogo = "${url.resourcesPath}/img/dotnet-liguria-storico-dark">
      <#assign dnlLogoImage>
        <img class="dnl-logo" src="${dnlLogo}.png" srcset="${dnlLogo}.png 1x, ${dnlLogo}-2x.png 2x"
             width="241" height="105" alt="${msg("dnlLogoAlt")}">
      </#assign>
      <#if (client.baseUrl)?has_content>
        <a id="kc-header-wrapper" class="dnl-brand" href="${client.baseUrl}">${dnlLogoImage}</a>
      <#else>
        <div id="kc-header-wrapper" class="dnl-brand">${dnlLogoImage}</div>
      </#if>
      <#-- DNL: the language switch moved here from the card header (upstream markup, unchanged), so that it sits next to the logo. -->
      <#if realm.internationalizationEnabled  && locale.supported?size gt 1>
      <div class="${properties.kcLoginMainHeaderUtilities!} dnl-lang">
        <div class="${properties.kcInputClass!}">
          <select
            aria-label="${msg("languages")}"
            id="login-select-toggle"
            onchange="if (this.value) window.location.href=this.value"
          >
            <#list locale.supported?sort_by("label") as l>
              <option
                value="${l.url}"
                ${(l.languageTag == locale.currentLanguageTag)?then('selected','')}
              >
                ${l.label}
              </option>
            </#list>
          </select>
          <span class="${properties.kcFormControlUtilClass}">
            <span class="${properties.kcFormControlToggleIcon!}">
              <svg
                class="pf-v5-svg"
                viewBox="0 0 320 512"
                fill="currentColor"
                aria-hidden="true"
                role="img"
                width="1em"
                height="1em"
              >
                <path
                  d="M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z"
                >
                </path>
              </svg>
            </span>
          </span>
        </div>
      </div>
      </#if>
    </header>
    <main class="${properties.kcLoginMain!}">
      <div class="${properties.kcLoginMainHeader!}">
        <h1 class="${properties.kcLoginMainTitle!}" id="kc-page-title"><#nested "header"></h1>
      </div>
      <div class="${properties.kcLoginMainBody!}">
        <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="${properties.kcInputHelperTextItemTextClass!}">
                          <span class="${properties.kcInputRequiredClass!}">*</span> ${msg("requiredFields")}
                        </span>
                    </div>
                </div>
            </#if>
        <#else>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="${properties.kcInputHelperTextItemTextClass!}">
                          <span class="${properties.kcInputRequiredClass!}">*</span> ${msg("requiredFields")}
                        </span>
                    </div>
                    <div class="${properties.kcFormClass} ${properties.kcContentWrapperClass}">
                        <#nested "show-username">
                        <@username />
                    </div>
                </div>
            <#else>
                <div class="${properties.kcFormClass} ${properties.kcContentWrapperClass}">
                  <#nested "show-username">
                  <@username />
                </div>
            </#if>
        </#if>

        <#-- App-initiated actions should not see warning messages about the need to complete the action -->
        <#-- during login.                                                                               -->
        <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
            <#-- DNL: announced by screen readers; decorative icon hidden; the type is written out, not only coloured. -->
            <div class="${properties.kcAlertClass!} pf-m-${(message.type = 'error')?then('danger', message.type)}"
                 role="${(message.type = 'error' || message.type = 'warning')?then('alert', 'status')}">
                <div class="${properties.kcAlertIconClass!}" aria-hidden="true">
                    <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                    <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                    <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                    <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                </div>
                <span class="${properties.kcAlertTitleClass!} kc-feedback-text"><span class="dnl-sr-only">${msg("dnlFeedback-${message.type}")}: </span>${message.summary}</span>
            </div>
        </#if>

        <#nested "form">

        <#if auth?has_content && auth.showTryAnotherWayLink()>
          <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post" novalidate="novalidate">
              <input type="hidden" name="tryAnotherWay" value="on"/>
              <a id="try-another-way" href="javascript:document.forms['kc-select-try-another-way-form'].requestSubmit()"
                  class="${properties.kcButtonSecondaryClass} ${properties.kcButtonBlockClass} ${properties.kcMarginTopClass}">
                    ${msg("doTryAnotherWay")}
              </a>
          </form>
        </#if>

          <div class="${properties.kcLoginMainFooter!}">
              <#nested "socialProviders">

              <#if displayInfo>
                  <div id="kc-info" class="${properties.kcLoginMainFooterBand!} ${properties.kcFormClass}">
                      <div id="kc-info-wrapper" class="${properties.kcLoginMainFooterBandItem!}">
                          <#nested "info">
                      </div>
                  </div>
              </#if>
          </div>
      </div>

        <div class="${properties.kcLoginMainFooter!}">
            <@loginFooter.content/>
        </div>
    </main>
  </div>
</div>
</body>
</html>
</#macro>
