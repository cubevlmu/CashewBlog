/** Keep browser navigation on the ASP.NET origin; leave Vite resources and HMR alone. */
export function gatewayEntry(origin) {
	const gateway = new URL(origin);
	return {
		name: "cashewblog-gateway-entry",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				if (
					!["GET", "HEAD"].includes(request.method ?? "") ||
					request.headers.upgrade ||
					request.headers.host === gateway.host ||
					request.headers["x-forwarded-host"]
				) return next();

				const url = new URL(request.url ?? "/", gateway);
				const adminRoute = /^\/(admin|setup)(\/|$)/i.test(url.pathname);
				const documentRequest = request.headers["sec-fetch-dest"] === "document" ||
					String(request.headers.accept ?? "").includes("text/html");
				if (!adminRoute && !documentRequest) return next();

				const target = new URL(gateway.origin);
				target.pathname = url.pathname;
				target.search = url.search;
				response.writeHead(302, { Location: target.href, "Cache-Control": "no-store" });
				response.end();
			});
		},
	};
}
