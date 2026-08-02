# Deploy with Docker

This project ships a root `Dockerfile` that pins **Node 22** and builds Next.js in `standalone` mode so local and Railway run the same runtime.

## Railway

`railway.toml` uses the Docker builder (`builder = "DOCKERFILE"`). Push and Railway will build the image; runtime env vars are injected by Railway (do not bake secrets into the image).

## Local

```bash
docker build -t seedpower-blog .
docker run --rm -p 3000:3000 --env-file .env.local seedpower-blog
```

## Static export

If `EXPORT=1`, Next still uses `output: 'export'` instead of `standalone` (not used by this Dockerfile).
