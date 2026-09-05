export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		const getCookie = (name) => {
			const cookie = request.headers.get("Cookie");

			if (!cookie) {
				return null;
			}

			const cookies = cookie.split(";");

			for (const item of cookies) {
				const index = item.indexOf("=");

				if (index === -1) {
					continue;
				}

				const key = item.slice(0, index).trim();
				const value = item.slice(index + 1).trim();

				if (key === name) {
					try {
						return decodeURIComponent(value);
					} catch {
						return value;
					}
				}
			}

			return null;
		};

		const getUser = (specifiedUser) => {
			if (typeof specifiedUser === "string" && specifiedUser.trim()) {
				return specifiedUser.trim();
			}

			const uid = getCookie("uid");

			if (uid && uid.trim()) {
				return uid.trim();
			}

			return null;
		};

		const formatUser = (result) => ({
			user: result.user,
			text: result.text,
			voice: result.voice,
			media: result.media,
			management: result.management,
			api: result.api,
			gateway: result.gateway,
			use: result.use
		});

		if (request.method === "GET" && url.pathname === "/get_resource") {
			const user = getUser(url.searchParams.get("user"));

			if (!user) {
				return Response.json(
					{
						success: false,
						error: "user is required"
					},
					{ status: 400 }
				);
			}

			const result = await env.resource_db
				.prepare(
					`SELECT user, text, voice, media, management, api, gateway, use
					 FROM users
					 WHERE user = ?`
				)
				.bind(user)
				.first();

			if (!result) {
				return Response.json(
					{
						success: false,
						error: "User not found"
					},
					{ status: 404 }
				);
			}

			return Response.json({
				success: true,
				data: formatUser(result)
			});
		}

		if (request.method === "POST" && url.pathname === "/set_resource") {
			let body;

			try {
				body = await request.json();
			} catch {
				return Response.json(
					{
						success: false,
						error: "Invalid JSON"
					},
					{ status: 400 }
				);
			}

			if (!body || typeof body !== "object" || Array.isArray(body)) {
				return Response.json(
					{
						success: false,
						error: "Request body must be an object"
					},
					{ status: 400 }
				);
			}

			const user = getUser(body.user);

			if (!user) {
				return Response.json(
					{
						success: false,
						error: "user is required"
					},
					{ status: 400 }
				);
			}

			const fields = [
				"text",
				"voice",
				"media",
				"management",
				"api",
				"gateway",
				"use"
			];

			const updates = [];
			const values = [];

			for (const field of fields) {
				if (!Object.prototype.hasOwnProperty.call(body, field)) {
					continue;
				}

				if (
					[
						"text",
						"voice",
						"media",
						"management",
						"api",
						"gateway"
					].includes(field)
				) {
					if (typeof body[field] !== "string") {
						return Response.json(
							{
								success: false,
								error: `${field} must be a string`
							},
							{ status: 400 }
						);
					}
				}

				if (field === "use") {
					if (
						typeof body[field] !== "number" ||
						!Number.isInteger(body[field])
					) {
						return Response.json(
							{
								success: false,
								error: "use must be an integer"
							},
							{ status: 400 }
						);
					}
				}

				updates.push(`${field} = ?`);
				values.push(body[field]);
			}

			if (updates.length === 0) {
				const result = await env.resource_db
					.prepare(
						`SELECT user, text, voice, media, management, api, gateway, use
						 FROM users
						 WHERE user = ?`
					)
					.bind(user)
					.first();

				if (!result) {
					return Response.json(
						{
							success: false,
							error: "User not found"
						},
						{ status: 404 }
					);
				}

				return Response.json({
					success: true,
					data: formatUser(result)
				});
			}

			values.push(user);

			const result = await env.resource_db
				.prepare(
					`UPDATE users
					 SET ${updates.join(", ")}
					 WHERE user = ?`
				)
				.bind(...values)
				.run();

			if (result.meta.changes === 0) {
				return Response.json(
					{
						success: false,
						error: "User not found"
					},
					{ status: 404 }
				);
			}

			const updated = await env.resource_db
				.prepare(
					`SELECT user, text, voice, media, management, api, gateway, use
					 FROM users
					 WHERE user = ?`
				)
				.bind(user)
				.first();

			return Response.json({
				success: true,
				data: formatUser(updated)
			});
		}

		return Response.json(
			{
				success: false,
				error: "Not Found"
			},
			{ status: 404 }
		);
	}
};