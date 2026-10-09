//#region src/constants.ts
var scriptFilename = "OidcTrustedDomains.js";
var TOKEN = {
	REFRESH_TOKEN: "REFRESH_TOKEN_SECURED_BY_OIDC_SERVICE_WORKER",
	ACCESS_TOKEN: "ACCESS_TOKEN_SECURED_BY_OIDC_SERVICE_WORKER",
	NONCE_TOKEN: "NONCE_SECURED_BY_OIDC_SERVICE_WORKER",
	CODE_VERIFIER: "CODE_VERIFIER_SECURED_BY_OIDC_SERVICE_WORKER"
};
var TokenRenewMode = {
	access_token_or_id_token_invalid: "access_token_or_id_token_invalid",
	access_token_invalid: "access_token_invalid",
	id_token_invalid: "id_token_invalid"
};
//#endregion
//#region src/jwt.ts
function strToUint8(str) {
	return new TextEncoder().encode(str);
}
function binToUrlBase64(bin) {
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+/g, "");
}
function utf8ToBinaryString(str) {
	return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
		return String.fromCharCode(parseInt(p1, 16));
	});
}
var uint8ToUrlBase64 = (uint8) => {
	let bin = "";
	uint8.forEach(function(code) {
		bin += String.fromCharCode(code);
	});
	return binToUrlBase64(bin);
};
function strToUrlBase64(str) {
	return binToUrlBase64(utf8ToBinaryString(str));
}
var defaultDemonstratingProofOfPossessionConfiguration = {
	importKeyAlgorithm: {
		name: "ECDSA",
		namedCurve: "P-256",
		hash: { name: "ES256" }
	},
	signAlgorithm: {
		name: "ECDSA",
		hash: { name: "SHA-256" }
	},
	generateKeyAlgorithm: {
		name: "ECDSA",
		namedCurve: "P-256"
	},
	digestAlgorithm: { name: "SHA-256" },
	jwtHeaderAlgorithm: "ES256"
};
var sign = (w) => async (jwk, headers, claims, demonstratingProofOfPossessionConfiguration, jwtHeaderType = "dpop+jwt") => {
	jwk = Object.assign({}, jwk);
	headers.typ = jwtHeaderType;
	headers.alg = demonstratingProofOfPossessionConfiguration.jwtHeaderAlgorithm;
	switch (headers.alg) {
		case "ES256":
			headers.jwk = {
				kty: jwk.kty,
				crv: jwk.crv,
				x: jwk.x,
				y: jwk.y
			};
			break;
		case "RS256":
			headers.jwk = {
				kty: jwk.kty,
				n: jwk.n,
				e: jwk.e,
				kid: headers.kid
			};
			break;
		default: throw new Error("Unknown or not implemented JWS algorithm");
	}
	const jws = {
		protected: strToUrlBase64(JSON.stringify(headers)),
		payload: strToUrlBase64(JSON.stringify(claims))
	};
	const keyType = demonstratingProofOfPossessionConfiguration.importKeyAlgorithm;
	const privateKey = await w.crypto.subtle.importKey("jwk", jwk, keyType, true, ["sign"]);
	const data = strToUint8(`${jws.protected}.${jws.payload}`);
	const signatureType = demonstratingProofOfPossessionConfiguration.signAlgorithm;
	const signature = await w.crypto.subtle.sign(signatureType, privateKey, data);
	jws.signature = uint8ToUrlBase64(new Uint8Array(signature));
	return `${jws.protected}.${jws.payload}.${jws.signature}`;
};
var JWT = { sign };
var generate = (w) => async (generateKeyAlgorithm) => {
	const keyType = generateKeyAlgorithm;
	const key = await w.crypto.subtle.generateKey(keyType, true, ["sign", "verify"]);
	return await w.crypto.subtle.exportKey("jwk", key.privateKey);
};
var neuter = (jwk) => {
	const copy = Object.assign({}, jwk);
	delete copy.d;
	copy.key_ops = ["verify"];
	return copy;
};
var EC = {
	generate,
	neuter
};
var thumbprint = (w) => async (jwk, digestAlgorithm) => {
	let sortedPub;
	switch (jwk.kty) {
		case "EC":
			sortedPub = "{\"crv\":\"CRV\",\"kty\":\"EC\",\"x\":\"X\",\"y\":\"Y\"}".replace("CRV", jwk.crv).replace("X", jwk.x).replace("Y", jwk.y);
			break;
		case "RSA":
			sortedPub = "{\"e\":\"E\",\"kty\":\"RSA\",\"n\":\"N\"}".replace("E", jwk.e).replace("N", jwk.n);
			break;
		default: throw new Error("Unknown or not implemented JWK type");
	}
	const hash = await w.crypto.subtle.digest(digestAlgorithm, strToUint8(sortedPub));
	return uint8ToUrlBase64(new Uint8Array(hash));
};
var JWK = { thumbprint };
var generateJwkAsync = (w) => async (generateKeyAlgorithm) => {
	return await EC.generate(w)(generateKeyAlgorithm);
};
var generateJwtDemonstratingProofOfPossessionAsync = (w) => (demonstratingProofOfPossessionConfiguration) => async (jwk, method = "POST", url, extrasClaims = {}) => {
	const claims = {
		jti: btoa(w.crypto.randomUUID()),
		htm: method,
		htu: url,
		iat: Math.round(Date.now() / 1e3),
		...extrasClaims
	};
	const kid = await JWK.thumbprint(w)(jwk, demonstratingProofOfPossessionConfiguration.digestAlgorithm);
	return await JWT.sign(w)(jwk, { kid }, claims, demonstratingProofOfPossessionConfiguration);
};
//#endregion
//#region src/crypto.ts
function textEncodeLite(str) {
	const buf = new ArrayBuffer(str.length);
	const bufView = new Uint8Array(buf);
	for (let i = 0; i < str.length; i++) bufView[i] = str.charCodeAt(i);
	return bufView;
}
function base64urlOfHashOfASCIIEncodingAsync(code) {
	return new Promise((resolve, reject) => {
		crypto.subtle.digest("SHA-256", textEncodeLite(code)).then((buffer) => {
			return resolve(uint8ToUrlBase64(new Uint8Array(buffer)));
		}, (error) => reject(error));
	});
}
//#endregion
//#region src/dpop.ts
var isDpop = (trustedDomain) => {
	if (Array.isArray(trustedDomain)) return false;
	return trustedDomain.demonstratingProofOfPossession ?? false;
};
var getDpopConfiguration = (trustedDomain) => {
	if (!isDpop(trustedDomain)) return null;
	if (Array.isArray(trustedDomain)) return null;
	return trustedDomain.demonstratingProofOfPossessionConfiguration ?? defaultDemonstratingProofOfPossessionConfiguration;
};
var getDpopOnlyWhenDpopHeaderPresent = (trustedDomain) => {
	if (!isDpop(trustedDomain)) return null;
	if (Array.isArray(trustedDomain)) return null;
	return trustedDomain.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent ?? true;
};
//#endregion
//#region src/utils/normalizeUrl.ts
function normalizeUrl(url) {
	try {
		return new URL(url).toString();
	} catch (error) {
		console.error(`Failed to normalize url: ${url}`, error);
		return url;
	}
}
//#endregion
//#region src/utils/domains.ts
function checkDomain(domains, endpoint) {
	if (!endpoint) return;
	if (!domains.find((domain) => {
		let testable;
		if (typeof domain === "string") testable = new RegExp(`^${domain}`);
		else testable = domain;
		return testable.test?.(endpoint);
	})) throw new Error("Domain " + endpoint + " is not trusted, please add domain in " + scriptFilename);
}
var getDomains = (trustedDomain, type) => {
	if (Array.isArray(trustedDomain)) return trustedDomain;
	return trustedDomain[`${type}Domains`] ?? trustedDomain.domains ?? [];
};
var getCurrentDatabaseDomain = (database, url, trustedDomains) => {
	if (url.endsWith("/.well-known/openid-configuration")) return null;
	const datatases = [];
	for (const [key, currentDatabase] of Object.entries(database)) {
		const oidcServerConfiguration = currentDatabase.oidcServerConfiguration;
		if (!oidcServerConfiguration) continue;
		if (oidcServerConfiguration.tokenEndpoint && url === normalizeUrl(oidcServerConfiguration.tokenEndpoint)) continue;
		if (oidcServerConfiguration.revocationEndpoint && url === normalizeUrl(oidcServerConfiguration.revocationEndpoint)) continue;
		const domains = getDomains(trustedDomains == null ? [] : trustedDomains[key.split("#")[0]], "accessToken");
		const domainsToSendTokens = oidcServerConfiguration.userInfoEndpoint ? [normalizeUrl(oidcServerConfiguration.userInfoEndpoint), ...domains] : [...domains];
		let hasToSendToken = false;
		if (domainsToSendTokens.find((f) => f === "*")) hasToSendToken = true;
		else for (let i = 0; i < domainsToSendTokens.length; i++) {
			let domain = domainsToSendTokens[i];
			if (typeof domain === "string") domain = new RegExp(`^${domain}`);
			if (domain.test?.(url)) {
				hasToSendToken = true;
				break;
			}
		}
		if (hasToSendToken) {
			if (currentDatabase.tokens) datatases.push(currentDatabase);
		}
	}
	return datatases;
};
//#endregion
//#region src/utils/serializeHeaders.ts
function serializeHeaders(headers) {
	const headersObj = {};
	for (const key of headers.keys()) {
		const value = headers.get(key);
		if (value !== null) headersObj[key] = value;
	}
	return headersObj;
}
//#endregion
//#region src/utils/shouldBypassDestination.ts
var bypassedDestinations = [
	"image",
	"font",
	"media",
	"document",
	"iframe",
	"script"
];
/**
* Determines whether a fetch event should be bypassed (not intercepted by the service worker).
* Navigation requests (mode === 'navigate') are never bypassed, even when their destination
* is in the bypassed list, so that access tokens can be injected into new-tab navigations.
*/
var shouldBypassDestination = (destination, mode) => {
	return bypassedDestinations.includes(destination) && mode !== "navigate";
};
//#endregion
//#region src/utils/sleep.ts
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//#endregion
//#region src/utils/tokens.ts
var parseJwt = (payload) => {
	return JSON.parse(b64DecodeUnicode(payload.replaceAll(/-/g, "+").replaceAll(/_/g, "/")));
};
function b64DecodeUnicode(str) {
	return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
}
function computeTimeLeft(refreshTimeBeforeTokensExpirationInSecond, expiresAt) {
	const currentTimeUnixSecond = (/* @__PURE__ */ new Date()).getTime() / 1e3;
	return Math.round(expiresAt - refreshTimeBeforeTokensExpirationInSecond - currentTimeUnixSecond);
}
function isTokensValid(tokens) {
	if (!tokens) return false;
	return computeTimeLeft(0, tokens.expiresAt) > 0;
}
var extractTokenPayload = (token) => {
	try {
		if (!token) return null;
		const parts = token.split(".");
		return parts.length === 3 ? parseJwt(parts[1]) : null;
	} catch (e) {
		console.warn(e);
	}
	return null;
};
var isTokensOidcValid = (tokens, nonce, oidcServerConfiguration) => {
	if (tokens.idTokenPayload) {
		const idTokenPayload = tokens.idTokenPayload;
		if (idTokenPayload && oidcServerConfiguration.issuer !== idTokenPayload.iss) return {
			isValid: false,
			reason: `Issuer does not match (oidcServerConfiguration issuer) ${oidcServerConfiguration.issuer} !== (idTokenPayload issuer) ${idTokenPayload.iss}`
		};
		const currentTimeUnixSecond = (/* @__PURE__ */ new Date()).getTime() / 1e3;
		if (idTokenPayload && idTokenPayload.exp && idTokenPayload.exp < currentTimeUnixSecond) return {
			isValid: false,
			reason: `Token expired at (idTokenPayload exp) ${idTokenPayload.exp} < (currentTimeUnixSecond) ${currentTimeUnixSecond}`
		};
		const timeInSevenDays = 604800;
		if (idTokenPayload && idTokenPayload.iat && idTokenPayload.iat + timeInSevenDays < currentTimeUnixSecond) return {
			isValid: false,
			reason: `Token is used from too long time (idTokenPayload iat + timeInSevenDays) ${idTokenPayload.iat + timeInSevenDays} < (currentTimeUnixSecond) ${currentTimeUnixSecond}`
		};
		if (idTokenPayload && nonce && idTokenPayload.nonce && idTokenPayload.nonce !== nonce) return {
			isValid: false,
			reason: `Nonce does not match (nonce) ${nonce} !== (idTokenPayload nonce) ${idTokenPayload.nonce}`
		};
	}
	return {
		isValid: true,
		reason: ""
	};
};
function extractedIssueAt(tokens, accessTokenPayload, _idTokenPayload) {
	if (!tokens.issued_at) {
		if (accessTokenPayload && accessTokenPayload.iat) return accessTokenPayload.iat;
		else if (_idTokenPayload && _idTokenPayload.iat) return _idTokenPayload.iat;
		else return (/* @__PURE__ */ new Date()).getTime() / 1e3;
	} else if (typeof tokens.issued_at == "string") return parseInt(tokens.issued_at, 10);
	return tokens.issued_at;
}
function _hideTokens(tokens, currentDatabaseElement, configurationName) {
	if (!tokens.issued_at) tokens.issued_at = (/* @__PURE__ */ new Date()).getTime() / 1e3;
	else if (typeof tokens.issued_at == "string") tokens.issued_at = parseInt(tokens.issued_at, 10);
	const accessTokenPayload = extractTokenPayload(tokens.access_token);
	const secureTokens = {
		...tokens,
		accessTokenPayload
	};
	if (currentDatabaseElement.hideAccessToken) secureTokens.access_token = `${TOKEN.ACCESS_TOKEN}_${configurationName}`;
	tokens.accessTokenPayload = accessTokenPayload;
	const oldTokens = currentDatabaseElement.tokens;
	let id_token;
	if (oldTokens != null && "id_token" in oldTokens && !("id_token" in tokens)) id_token = oldTokens.id_token;
	else id_token = tokens.id_token;
	tokens.id_token = id_token;
	let _idTokenPayload = null;
	if (id_token) {
		_idTokenPayload = extractTokenPayload(id_token);
		tokens.idTokenPayload = _idTokenPayload != null ? { ..._idTokenPayload } : null;
		if (_idTokenPayload && _idTokenPayload.nonce && currentDatabaseElement.nonce != null) {
			const keyNonce = `${TOKEN.NONCE_TOKEN}_${currentDatabaseElement.configurationName}`;
			_idTokenPayload.nonce = keyNonce;
		}
		secureTokens.idTokenPayload = _idTokenPayload;
	}
	if (tokens.refresh_token) secureTokens.refresh_token = `${TOKEN.REFRESH_TOKEN}_${configurationName}`;
	tokens.issued_at = extractedIssueAt(tokens, accessTokenPayload, _idTokenPayload);
	const expireIn = typeof tokens.expires_in == "string" ? parseInt(tokens.expires_in, 10) : tokens.expires_in;
	const idTokenExpiresAt = _idTokenPayload && _idTokenPayload.exp ? _idTokenPayload.exp : Number.MAX_VALUE;
	const accessTokenExpiresAt = accessTokenPayload && accessTokenPayload.exp ? accessTokenPayload.exp : tokens.issued_at + expireIn;
	let expiresAt;
	const tokenRenewMode = currentDatabaseElement.oidcConfiguration.token_renew_mode;
	if (tokenRenewMode === TokenRenewMode.access_token_invalid) expiresAt = accessTokenExpiresAt;
	else if (tokenRenewMode === TokenRenewMode.id_token_invalid) expiresAt = idTokenExpiresAt;
	else expiresAt = idTokenExpiresAt < accessTokenExpiresAt ? idTokenExpiresAt : accessTokenExpiresAt;
	secureTokens.expiresAt = expiresAt;
	tokens.expiresAt = expiresAt;
	const { isValid, reason } = isTokensOidcValid(tokens, currentDatabaseElement.nonce ? currentDatabaseElement.nonce.nonce : null, currentDatabaseElement.oidcServerConfiguration);
	if (!isValid) throw Error(`Tokens are not OpenID valid, reason: ${reason}`);
	if (oldTokens != null && "refresh_token" in oldTokens && !("refresh_token" in tokens)) {
		const refreshToken = oldTokens.refresh_token;
		currentDatabaseElement.tokens = {
			...tokens,
			refresh_token: refreshToken
		};
	} else currentDatabaseElement.tokens = tokens;
	currentDatabaseElement.status = "LOGGED_IN";
	return secureTokens;
}
var demonstratingProofOfPossessionNonceResponseHeader = "DPoP-Nonce";
function hideTokens(currentDatabaseElement) {
	const configurationName = currentDatabaseElement.configurationName;
	return (response) => {
		if (response.status !== 200) return response;
		const newHeaders = new Headers(response.headers);
		if (response.headers.has(demonstratingProofOfPossessionNonceResponseHeader)) {
			currentDatabaseElement.demonstratingProofOfPossessionNonce = response.headers.get(demonstratingProofOfPossessionNonceResponseHeader);
			newHeaders.delete(demonstratingProofOfPossessionNonceResponseHeader);
		}
		return response.json().then((tokens) => {
			const secureTokens = _hideTokens(tokens, currentDatabaseElement, configurationName);
			const body = JSON.stringify(secureTokens);
			return new Response(body, {
				status: response.status,
				statusText: response.statusText,
				headers: newHeaders
			});
		});
	};
}
//#endregion
//#region src/utils/waitForValidTokens.ts
var TOKEN_RENEWAL_TIMEOUT_MS = 5e3;
/**
* Polls until the tokens in the given config are valid, or until a timeout elapses.
*
* @returns `null` when tokens become valid; a synthetic 401 `Response` on timeout or
*          when the tokens are cleared while waiting (e.g. due to a parallel logout).
*/
async function waitForValidTokens(config, maxWaitMs = TOKEN_RENEWAL_TIMEOUT_MS, pollIntervalMs = 200) {
	const startTime = Date.now();
	while (config.tokens && !isTokensValid(config.tokens)) {
		if (Date.now() - startTime >= maxWaitMs) return new Response(null, {
			status: 401,
			statusText: "Token expired - service worker renewal timeout"
		});
		await sleep(pollIntervalMs);
	}
	if (!config.tokens?.access_token) return new Response(null, {
		status: 401,
		statusText: "Missing access token"
	});
	return null;
}
//#endregion
//#region src/oidcConfig.ts
var getOidcServerUrls = (oidcServerConfiguration) => {
	return [
		oidcServerConfiguration.issuer,
		oidcServerConfiguration.authorizationEndpoint,
		oidcServerConfiguration.tokenEndpoint,
		oidcServerConfiguration.revocationEndpoint,
		oidcServerConfiguration.userInfoEndpoint
	].filter(Boolean).map(normalizeUrl);
};
var isOidcServerRequest = (database, normalizedUrl) => {
	return Object.values(database).some((config) => {
		const { oidcServerConfiguration } = config || {};
		if (!oidcServerConfiguration) return false;
		return getOidcServerUrls(oidcServerConfiguration).some((oidcUrl) => normalizedUrl.startsWith(oidcUrl));
	});
};
var isDomainMatchingUrl = (domain, normalizedUrl) => {
	if (typeof domain === "string") domain = new RegExp(`^${domain}`);
	return domain.test?.(normalizedUrl) ?? false;
};
var isAccessTokenDomainRequest = (database, normalizedUrl, trustedDomains) => {
	return Object.entries(database).some(([key, currentDatabase]) => {
		if (!currentDatabase.oidcServerConfiguration) return false;
		const domains = getDomains(trustedDomains?.[key.split("#")[0]] ?? [], "accessToken");
		if (domains.some((domain) => domain === "*")) return true;
		return domains.some((domain) => isDomainMatchingUrl(domain, normalizedUrl));
	});
};
var shouldBypassNonOidcRequest = (database, normalizedUrl, trustedDomains) => {
	const configurations = Object.values(database);
	if (configurations.length === 0) return false;
	if (!configurations.every((config) => config.bypassAllNonOidcRequests)) return false;
	if (!configurations.every((config) => config.oidcServerConfiguration != null)) return false;
	return !isOidcServerRequest(database, normalizedUrl) && !isAccessTokenDomainRequest(database, normalizedUrl, trustedDomains);
};
var getMatchingOidcConfigurations = (database, url) => {
	const normalizedUrl = normalizeUrl(url);
	return Object.values(database).filter((config) => {
		const { oidcServerConfiguration } = config || {};
		const { tokenEndpoint, revocationEndpoint } = oidcServerConfiguration || {};
		return tokenEndpoint && normalizedUrl.startsWith(normalizeUrl(tokenEndpoint)) || revocationEndpoint && normalizedUrl.startsWith(normalizeUrl(revocationEndpoint));
	});
};
//#endregion
//#region src/utils/codeVerifier.ts
function replaceCodeVerifier(codeVerifier, newCodeVerifier) {
	return codeVerifier.replace(/[?&]code_verifier=([^&]+)/i, `&code_verifier=${newCodeVerifier}`);
}
var extractConfigurationNameFromCodeVerifier = (body) => {
	const match = body.match(/[?&]code_verifier=CODE_VERIFIER_SECURED_BY_OIDC_SERVICE_WORKER_([^&]+)/);
	return match ? decodeURIComponent(match[1]) : "";
};
//#endregion
//#region src/version.ts
var version_default = "7.29.6";
//#endregion
//#region src/OidcServiceWorker.ts
if (typeof trustedTypes !== "undefined" && typeof trustedTypes.createPolicy === "function") trustedTypes.createPolicy("default", { createScriptURL: function(url) {
	if (url === "OidcTrustedDomains.js") return url;
	else throw new Error("Untrusted script URL blocked: " + url);
} });
var _self = self;
_self.importScripts(scriptFilename);
var id = Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3).toString();
console.log("init service worker with id", id);
var keepAliveJsonFilename = "OidcKeepAliveServiceWorker.json";
var database = {};
/**
* Keeps the service worker alive by responding with a cached response after a sleep.
*/
var keepAliveAsync = async (event) => {
	const originalRequest = event.request;
	const isFromVanilla = originalRequest.headers.has("oidc-vanilla");
	const response = new Response("{}", {
		status: 200,
		statusText: "oidc-service-worker"
	});
	if (!isFromVanilla) {
		const originalRequestUrl = new URL(originalRequest.url);
		const minSleepSeconds = Number(originalRequestUrl.searchParams.get("minSleepSeconds")) || 240;
		for (let i = 0; i < minSleepSeconds; i++) {
			await sleep(1e3 + Math.floor(Math.random() * 1e3));
			await (await caches.open("oidc_dummy_cache")).put(event.request, response.clone());
		}
	}
	return response;
};
/**
* Generates DPoP headers when a DPoP configuration is present.
*/
async function generateDpopAsync(originalRequest, currentDatabase, url, extrasClaims = {}) {
	const headersExtras = serializeHeaders(originalRequest.headers);
	if (currentDatabase?.demonstratingProofOfPossessionConfiguration && currentDatabase.demonstratingProofOfPossessionJwkJson && (!currentDatabase.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent || currentDatabase.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent && headersExtras.dpop)) {
		const dpopConfiguration = currentDatabase.demonstratingProofOfPossessionConfiguration;
		const jwk = currentDatabase.demonstratingProofOfPossessionJwkJson;
		const method = originalRequest.method;
		headersExtras.dpop = await generateJwtDemonstratingProofOfPossessionAsync(self)(dpopConfiguration)(jwk, method, url, extrasClaims);
		if (currentDatabase.demonstratingProofOfPossessionNonce != null) headersExtras.nonce = currentDatabase.demonstratingProofOfPossessionNonce;
	}
	return headersExtras;
}
/**
* Intercepts fetch requests to inject access tokens and handle token endpoints.
*/
var handleFetch = (event) => {
	/**
	* Exit early for requests that do not need to have an auth token attached.
	*/
	if (shouldBypassDestination(event.request.destination, event.request.mode)) return;
	const normalizedUrl = normalizeUrl(event.request.url);
	if (!normalizedUrl.includes(keepAliveJsonFilename) && shouldBypassNonOidcRequest(database, normalizedUrl, trustedDomains)) return;
	event.respondWith((async () => {
		try {
			const originalRequest = event.request;
			const url = normalizedUrl;
			if (url.includes(keepAliveJsonFilename)) return keepAliveAsync(event);
			const currentDatabasesForRequestAccessToken = getCurrentDatabaseDomain(database, url, trustedDomains);
			const authorization = originalRequest.headers.get("authorization");
			let authenticationMode = "Bearer";
			let key = "default";
			if (authorization) {
				const split = authorization.split(" ");
				authenticationMode = split[0];
				if (split[1]?.includes("ACCESS_TOKEN_SECURED_BY_OIDC_SERVICE_WORKER_")) key = split[1].split("ACCESS_TOKEN_SECURED_BY_OIDC_SERVICE_WORKER_")[1];
			}
			const currentDatabaseForRequestAccessToken = currentDatabasesForRequestAccessToken?.find((c) => c.configurationName.endsWith(key));
			if (currentDatabaseForRequestAccessToken?.tokens?.access_token) {
				const tokenError = await waitForValidTokens(currentDatabaseForRequestAccessToken);
				if (tokenError) return tokenError;
				let requestMode = originalRequest.mode;
				if (originalRequest.mode !== "navigate" && currentDatabaseForRequestAccessToken.convertAllRequestsToCorsExceptNavigate) requestMode = "cors";
				let headers;
				if (originalRequest.mode === "navigate" && !currentDatabaseForRequestAccessToken.setAccessTokenToNavigateRequests) headers = { ...serializeHeaders(originalRequest.headers) };
				else if (authenticationMode.toLowerCase() === "dpop" || !currentDatabaseForRequestAccessToken.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent && currentDatabaseForRequestAccessToken.demonstratingProofOfPossessionConfiguration) headers = {
					...await generateDpopAsync(originalRequest, currentDatabaseForRequestAccessToken, url, { ath: await base64urlOfHashOfASCIIEncodingAsync(currentDatabaseForRequestAccessToken.tokens.access_token) }),
					authorization: `DPoP ${currentDatabaseForRequestAccessToken.tokens.access_token}`
				};
				else headers = {
					...serializeHeaders(originalRequest.headers),
					authorization: `${authenticationMode} ${currentDatabaseForRequestAccessToken.tokens.access_token}`
				};
				let init;
				if (originalRequest.mode === "navigate") init = { headers };
				else init = {
					headers,
					mode: requestMode
				};
				const newRequest = new Request(originalRequest, init);
				return fetch(newRequest);
			}
			if (event.request.method !== "POST") return fetch(originalRequest);
			const currentDatabases = getMatchingOidcConfigurations(database, url);
			const numberDatabase = currentDatabases.length;
			if (numberDatabase > 0) return new Promise((resolve, reject) => {
				const clonedRequest = originalRequest.clone();
				clonedRequest.text().then(async (actualBody) => {
					let currentDatabase = null;
					try {
						if (actualBody.includes(TOKEN.REFRESH_TOKEN) || actualBody.includes(TOKEN.ACCESS_TOKEN)) {
							let headers = serializeHeaders(originalRequest.headers);
							let newBody = actualBody;
							for (let i = 0; i < numberDatabase; i++) {
								const currentDb = currentDatabases[i];
								if (currentDb?.tokens) {
									const claimsExtras = { ath: await base64urlOfHashOfASCIIEncodingAsync(currentDb.tokens.access_token) };
									headers = await generateDpopAsync(originalRequest, currentDb, url, claimsExtras);
									const keyRefreshToken = encodeURIComponent(`${TOKEN.REFRESH_TOKEN}_${currentDb.configurationName}`);
									if (actualBody.includes(keyRefreshToken)) {
										newBody = newBody.replace(keyRefreshToken, encodeURIComponent(currentDb.tokens.refresh_token));
										currentDatabase = currentDb;
										break;
									}
									const keyAccessToken = encodeURIComponent(`${TOKEN.ACCESS_TOKEN}_${currentDb.configurationName}`);
									if (actualBody.includes(keyAccessToken)) {
										newBody = newBody.replace(keyAccessToken, encodeURIComponent(currentDb.tokens.access_token));
										currentDatabase = currentDb;
										break;
									}
								}
							}
							const fetchPromise = fetch(originalRequest, {
								body: newBody,
								method: clonedRequest.method,
								headers,
								mode: clonedRequest.mode,
								cache: clonedRequest.cache,
								redirect: clonedRequest.redirect,
								referrer: clonedRequest.referrer,
								credentials: clonedRequest.credentials,
								integrity: clonedRequest.integrity
							});
							if (currentDatabase?.oidcServerConfiguration?.revocationEndpoint && url.startsWith(normalizeUrl(currentDatabase.oidcServerConfiguration.revocationEndpoint))) {
								const resp = await fetchPromise;
								const txt = await resp.text();
								resolve(new Response(txt, resp));
								return;
							}
							resolve(await fetchPromise.then(hideTokens(currentDatabase)));
							return;
						}
						if (actualBody.includes("code_verifier=")) {
							const currentLoginCallbackConfigurationName = extractConfigurationNameFromCodeVerifier(actualBody);
							if (!currentLoginCallbackConfigurationName || currentLoginCallbackConfigurationName === "") throw new Error("No configuration name found in code_verifier");
							currentDatabase = database[currentLoginCallbackConfigurationName];
							let newBody = actualBody;
							const codeVerifier = currentDatabase.codeVerifier;
							if (codeVerifier != null) newBody = replaceCodeVerifier(newBody, codeVerifier);
							const headersExtras = await generateDpopAsync(originalRequest, currentDatabase, url);
							const resp = await fetch(originalRequest, {
								body: newBody,
								method: clonedRequest.method,
								headers: headersExtras,
								mode: clonedRequest.mode,
								cache: clonedRequest.cache,
								redirect: clonedRequest.redirect,
								referrer: clonedRequest.referrer,
								credentials: clonedRequest.credentials,
								integrity: clonedRequest.integrity
							});
							resolve(await hideTokens(currentDatabase)(resp));
							return;
						}
						resolve(await fetch(originalRequest, {
							body: actualBody,
							method: clonedRequest.method,
							headers: serializeHeaders(originalRequest.headers),
							mode: clonedRequest.mode,
							cache: clonedRequest.cache,
							redirect: clonedRequest.redirect,
							referrer: clonedRequest.referrer,
							credentials: clonedRequest.credentials,
							integrity: clonedRequest.integrity
						}));
					} catch (err) {
						reject(err);
					}
				}).catch(reject);
			});
			return fetch(originalRequest);
		} catch (err) {
			console.error("[OidcServiceWorker] handleFetch error:", err);
			return new Response("Service Worker Error", { status: 500 });
		}
	})());
};
var handleMessage = async (event) => {
	const port = event.ports[0];
	const data = event.data;
	if (event.data?.type === "SKIP_WAITING") {
		await _self.skipWaiting();
		port?.postMessage?.({});
		return;
	} else if (event.data.type === "claim") {
		_self.clients.claim().then(() => port.postMessage({}));
		return;
	}
	const configurationName = data.configurationName.split("#")[0];
	if (trustedDomains == null) trustedDomains = {};
	const trustedDomain = trustedDomains[configurationName];
	const allowMultiTabLogin = Array.isArray(trustedDomain) ? false : trustedDomain.allowMultiTabLogin;
	const tabId = allowMultiTabLogin ? data.tabId : "default";
	const configurationNameWithTabId = `${configurationName}#tabId=${tabId}`;
	let currentDatabase = database[configurationNameWithTabId];
	if (!currentDatabase) {
		const showAccessToken = Array.isArray(trustedDomain) ? false : trustedDomain.showAccessToken;
		const doNotSetAccessTokenToNavigateRequests = Array.isArray(trustedDomain) ? true : trustedDomain.setAccessTokenToNavigateRequests;
		const convertAllRequestsToCorsExceptNavigate = Array.isArray(trustedDomain) ? false : trustedDomain.convertAllRequestsToCorsExceptNavigate;
		const bypassAllNonOidcRequests = Array.isArray(trustedDomain) ? false : trustedDomain.bypassAllNonOidcRequests;
		database[configurationNameWithTabId] = {
			tokens: null,
			state: null,
			codeVerifier: null,
			oidcServerConfiguration: null,
			oidcConfiguration: void 0,
			nonce: null,
			status: null,
			configurationName: configurationNameWithTabId,
			hideAccessToken: !showAccessToken,
			setAccessTokenToNavigateRequests: doNotSetAccessTokenToNavigateRequests ?? true,
			convertAllRequestsToCorsExceptNavigate: convertAllRequestsToCorsExceptNavigate ?? false,
			demonstratingProofOfPossessionNonce: null,
			demonstratingProofOfPossessionJwkJson: null,
			demonstratingProofOfPossessionConfiguration: null,
			demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent: false,
			allowMultiTabLogin: allowMultiTabLogin ?? false,
			bypassAllNonOidcRequests: bypassAllNonOidcRequests ?? false
		};
		currentDatabase = database[configurationNameWithTabId];
		if (!trustedDomains[configurationName]) trustedDomains[configurationName] = [];
	}
	switch (data.type) {
		case "clear":
			currentDatabase.tokens = null;
			currentDatabase.state = null;
			currentDatabase.codeVerifier = null;
			currentDatabase.nonce = null;
			currentDatabase.demonstratingProofOfPossessionNonce = null;
			currentDatabase.demonstratingProofOfPossessionJwkJson = null;
			currentDatabase.demonstratingProofOfPossessionConfiguration = null;
			currentDatabase.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent = false;
			currentDatabase.status = data.data.status;
			port.postMessage({ configurationName });
			return;
		case "init": {
			const oidcServerConfiguration = data.data.oidcServerConfiguration;
			const domains = getDomains(trustedDomain, "oidc");
			if (!domains.some((domain) => domain === "*")) [
				oidcServerConfiguration.tokenEndpoint,
				oidcServerConfiguration.revocationEndpoint,
				oidcServerConfiguration.userInfoEndpoint,
				oidcServerConfiguration.issuer
			].forEach((u) => {
				checkDomain(domains, u);
			});
			currentDatabase.oidcServerConfiguration = oidcServerConfiguration;
			currentDatabase.oidcConfiguration = data.data.oidcConfiguration;
			if (currentDatabase.demonstratingProofOfPossessionConfiguration == null) {
				const demonstratingProofOfPossessionConfiguration = getDpopConfiguration(trustedDomain);
				if (demonstratingProofOfPossessionConfiguration != null) {
					if (currentDatabase.oidcConfiguration.demonstrating_proof_of_possession) console.warn("In service worker, demonstrating_proof_of_possession must be configured from trustedDomains file");
					currentDatabase.demonstratingProofOfPossessionConfiguration = demonstratingProofOfPossessionConfiguration;
					currentDatabase.demonstratingProofOfPossessionJwkJson = await generateJwkAsync(self)(demonstratingProofOfPossessionConfiguration.generateKeyAlgorithm);
					currentDatabase.demonstratingProofOfPossessionOnlyWhenDpopHeaderPresent = getDpopOnlyWhenDpopHeaderPresent(trustedDomain) ?? false;
				}
			}
			if (!currentDatabase.tokens) port.postMessage({
				tokens: null,
				status: currentDatabase.status,
				configurationName,
				version: version_default
			});
			else {
				const tokens = { ...currentDatabase.tokens };
				if (currentDatabase.hideAccessToken) tokens.access_token = `${TOKEN.ACCESS_TOKEN}_${configurationName}#tabId=${tabId}`;
				if (tokens.refresh_token) tokens.refresh_token = `${TOKEN.REFRESH_TOKEN}_${configurationName}#tabId=${tabId}`;
				if (tokens?.idTokenPayload?.nonce && currentDatabase.nonce != null) tokens.idTokenPayload.nonce = `${TOKEN.NONCE_TOKEN}_${configurationName}#tabId=${tabId}`;
				port.postMessage({
					tokens,
					status: currentDatabase.status,
					configurationName,
					version: version_default
				});
			}
			return;
		}
		case "setDemonstratingProofOfPossessionNonce":
			currentDatabase.demonstratingProofOfPossessionNonce = data.data.demonstratingProofOfPossessionNonce;
			port.postMessage({ configurationName });
			return;
		case "getDemonstratingProofOfPossessionNonce": {
			const demonstratingProofOfPossessionNonce = currentDatabase.demonstratingProofOfPossessionNonce;
			port.postMessage({
				configurationName,
				demonstratingProofOfPossessionNonce
			});
			return;
		}
		case "setState":
			currentDatabase.state = data.data.state;
			port.postMessage({ configurationName });
			return;
		case "getState": {
			const state = currentDatabase.state;
			port.postMessage({
				configurationName,
				state
			});
			return;
		}
		case "setCodeVerifier":
			currentDatabase.codeVerifier = data.data.codeVerifier;
			port.postMessage({ configurationName });
			return;
		case "getCodeVerifier": {
			const codeVerifier = currentDatabase.codeVerifier != null ? `${TOKEN.CODE_VERIFIER}_${configurationName}#tabId=${tabId}` : null;
			port.postMessage({
				configurationName,
				codeVerifier
			});
			return;
		}
		case "setSessionState":
			currentDatabase.sessionState = data.data.sessionState;
			port.postMessage({ configurationName });
			return;
		case "getSessionState": {
			const sessionState = currentDatabase.sessionState;
			port.postMessage({
				configurationName,
				sessionState
			});
			return;
		}
		case "setNonce": {
			const nonce = data.data.nonce;
			if (nonce) currentDatabase.nonce = nonce;
			port.postMessage({ configurationName });
			return;
		}
		case "getNonce": {
			const keyNonce = `${TOKEN.NONCE_TOKEN}_${configurationName}#tabId=${tabId}`;
			const nonce = currentDatabase.nonce ? keyNonce : null;
			port.postMessage({
				configurationName,
				nonce
			});
			return;
		}
		default: return;
	}
};
_self.addEventListener("fetch", handleFetch);
_self.addEventListener("message", handleMessage);
//#endregion

//# sourceMappingURL=OidcServiceWorker.js.map