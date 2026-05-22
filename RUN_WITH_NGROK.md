# Run the Project with ngrok

This guide shows how to start the backend, frontend, and ngrok tunnels so the app is accessible publicly.

## Prerequisites

- Ubuntu Linux
- `ngrok` installed and available in `PATH`
- Project dependencies installed
  - Python dependencies in `.venv`
  - Frontend dependencies inside `frontend/node_modules`
- An ngrok authtoken configured
  - `ngrok config add-authtoken <your-token>` or `export NGROK_AUTHTOKEN=<your-token>`

## Start the Flask backend

From the project root:

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
./start_backend.sh
```

This starts the Flask backend on the detected port (default `7899`) and uses `.venv` Python when available.

## Start the Vite frontend

In a separate terminal:

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
./start_frontend.sh
```

This starts Vite with `--host` on `5173`.

## Start ngrok tunnels

In another terminal, set your ngrok auth token and run:

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
export NGROK_AUTHTOKEN="3DnIrrhCsr8N3CuDJmG3J8hdOsp_7PfmVezzkzREEE292vATh"
./start_ngrok.sh
```

> Note: Do not commit your ngrok auth token to version control. Keep this export command in a local shell session or your personal shell profile only.
>
> The script will create two tunnels and automatically restart the frontend if it is already running.

The script will create two tunnels:

- frontend → local `5173`
- backend  → local `7899`

It also writes the public backend URL into `frontend/.env.local` as `VITE_API_URL` and `VITE_API_BASE_URL` so the frontend can call the backend through ngrok.

If the frontend is already running, `./start_ngrok.sh` will stop and restart it so the new env values are applied.

## Verify the URLs

Open the ngrok inspector in your browser:

```bash
http://127.0.0.1:4040
```

The public URLs will be listed under the `frontend` and `backend` tunnels.

Then open the frontend public URL shown in the inspector or terminal, for example:

```bash
https://craftily-kindly-reviving.ngrok-free.dev
```

If Vite blocks the host, `frontend/vite.config.ts` now allows `.ngrok-free.dev` and `.ngrok.io` hosts so the live link opens correctly.

## Notes

- If the backend port is changed manually with `FLASK_PORT`, the script detects it automatically.
- If you need to restart the frontend after ngrok updates `frontend/.env.local`, stop and rerun `./start_frontend.sh`.
- The backend CORS settings allow `http://127.0.0.1:5173`, `http://localhost:5173`, `https://*.ngrok.io`, and `https://*.ngrok-free.app`.

## Quick full startup

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
./start_backend.sh
```

In a second terminal:

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
./start_frontend.sh
```

In a third terminal:

```bash
cd /home/hardik/Downloads/live_Rotation_token_e-commerce_project-main
export NGROK_AUTHTOKEN="3DnIrrhCsr8N3CuDJmG3J8hdOsp_7PfmVezzkzREEE292vATh"
./start_ngrok.sh
```
