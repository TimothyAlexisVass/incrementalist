# Incrementalist

A tiny incremental click game with an HTML5 canvas frontend, a Phoenix JSON backend, and Postgres storage.

## Run It

Make sure Postgres is running locally. The default dev config uses
`postgres:postgres@localhost:5432`, and you can override it with
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, and
`POSTGRES_DB`.

Install dependencies, create the database, and run migrations:

```sh
mix setup
```

Start Phoenix:

```sh
mix phx.server
```

Then open `http://localhost:4000`.

The app reads the click count for the current username on load and after each username edit. Each button press sends a click action to the backend, which creates the user with `1` click or increments their existing total.
