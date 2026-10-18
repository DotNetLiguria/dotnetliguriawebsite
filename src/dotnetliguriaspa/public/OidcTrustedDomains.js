// eslint-disable-next-line @typescript-eslint/no-unused-vars
const trustedDomains = {
    default: {
        oidcDomains: [
            /^https:\/\/hello\.vevy\.com\/realms\/DotNetLiguria(?:\/|\?|$)/,
        ],
        accessTokenDomains: [
            /^https:\/\/(?:www\.)?dotnetliguria\.net\/api(?:\/|\?|$)/,
            /^https:\/\/hello\.vevy\.com\/realms\/DotNetLiguria\/protocol\/openid-connect\/userinfo(?:\?|$)/,
            ...(self.location.hostname === 'localhost' && self.location.protocol === 'https:'
                ? [/^https:\/\/localhost:5443\/api(?:\/|\?|$)/]
                : []),
        ],
    },
};
