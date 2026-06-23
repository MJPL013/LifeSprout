export function getApiBaseUrl() {
    const configuredUrl = import.meta.env.VITE_API_URL?.trim();
    if (configuredUrl) {
        const normalizedUrl = configuredUrl.replace(/^\/+(https?:\/\/)/i, '$1');
        return normalizedUrl.replace(/\/+$/, '');
    }

    const { protocol, hostname, port, origin } = window.location;
    const isViteDevServer = ['5173', '5174', '5175'].includes(port);

    if (isViteDevServer) {
        return `${protocol}//${hostname}:3001`;
    }

    return origin;
}

export const API_URL = getApiBaseUrl();
export const SOCKET_URL = API_URL;