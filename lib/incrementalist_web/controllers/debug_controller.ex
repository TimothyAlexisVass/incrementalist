defmodule IncrementalistWeb.DebugController do
  use IncrementalistWeb, :controller

  alias Incrementalist.Game.Persistence.{Player, PlayerState, GameCommand}
  alias Incrementalist.Game.Persistence.PlayerStates
  alias Incrementalist.Game.Session.FullSnapshotOverrides
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo
  import Ecto.Query

  # Sleek premium styles
  @css """
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;700&family=Fira+Code:wght@400;500&display=swap');
    
    body {
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 1100px;
      margin: 40px auto;
      padding: 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #30363d;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      background: linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 18px;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease-in-out;
      border: 1px solid transparent;
    }

    .btn-primary {
      background-color: #1f6feb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background-color: #388bfd;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background-color: #21262d;
      color: #c9d1d9;
      border-color: #30363d;
    }
    .btn-secondary:hover {
      background-color: #30363d;
      border-color: #8b949e;
    }

    .btn-danger {
      background-color: #21262d;
      color: #f85149;
      border-color: rgba(248, 81, 73, 0.4);
    }
    .btn-danger:hover {
      background-color: #da3637;
      color: #ffffff;
      border-color: #f85149;
      transform: translateY(-1px);
    }

    .btn-action {
      padding: 6px 12px;
      font-size: 0.85rem;
    }

    /* Cards */
    .card {
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      font-family: 'Outfit', sans-serif;
      font-weight: 500;
      color: #8b949e;
      padding: 12px 16px;
      border-bottom: 1px solid #30363d;
      font-size: 0.95rem;
    }

    td {
      padding: 16px;
      border-bottom: 1px solid #21262d;
      font-size: 0.9rem;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: rgba(22, 27, 34, 0.6);
    }

    .tag {
      display: inline-block;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 12px;
    }

    .tag-success {
      background-color: rgba(46, 160, 67, 0.15);
      color: #3fb950;
      border: 1px solid rgba(46, 160, 67, 0.3);
    }

    .tag-warning {
      background-color: rgba(210, 153, 34, 0.15);
      color: #d29922;
      border: 1px solid rgba(210, 153, 34, 0.3);
    }

    .tag-danger {
      background-color: rgba(248, 81, 73, 0.15);
      color: #f85149;
      border: 1px solid rgba(248, 81, 73, 0.3);
    }

    /* Alert / Error Box */
    .alert {
      padding: 16px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-size: 0.9rem;
      border: 1px solid transparent;
    }

    .alert-error {
      background-color: rgba(248, 81, 73, 0.1);
      color: #f85149;
      border-color: rgba(248, 81, 73, 0.2);
    }

    .alert-success {
      background-color: rgba(46, 160, 67, 0.1);
      color: #3fb950;
      border-color: rgba(46, 160, 67, 0.2);
    }

    /* Form Fields */
    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 8px;
      color: #c9d1d9;
    }

    textarea {
      width: 100%;
      height: 500px;
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: 'Fira Code', monospace;
      font-size: 0.9rem;
      padding: 16px;
      border: 1px solid #30363d;
      border-radius: 6px;
      box-sizing: border-box;
      resize: vertical;
      line-height: 1.5;
    }

    textarea:focus {
      outline: none;
      border-color: #1f6feb;
      box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.3);
    }

    select:focus {
      border-color: #1f6feb !important;
      box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.3);
    }

    .breadcrumb {
      margin-bottom: 20px;
      font-size: 0.9rem;
      color: #8b949e;
    }

    .breadcrumb a {
      color: #58a6ff;
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }
  </style>
  """

  # ---------------------------------------------------------------------------
  # Index View: List of Players
  # ---------------------------------------------------------------------------
  def index(conn, params) do
    # Fetch players with a join on player_states to see if state exists
    query =
      from p in Player,
        left_join: ps in PlayerState,
        on: ps.player_id == p.id,
        order_by: [desc: p.id],
        select: %{
          id: p.id,
          username: p.username,
          email: p.email,
          last_seen_at: p.last_seen_at,
          inserted_at: p.inserted_at,
          has_state: not is_nil(ps.id),
          has_token: ps.has_bonustime_token
        }

    players = Repo.all(query)

    csrf_token = Plug.CSRFProtection.get_csrf_token()
    success_msg = Map.get(conn.assigns, :success_msg) || Map.get(params, "success")
    error_msg = Map.get(conn.assigns, :error_msg) || Map.get(params, "error")

    alert_html =
      cond do
        success_msg ->
          "<div class=\"alert alert-success\">#{success_msg}</div>"

        error_msg ->
          "<div class=\"alert alert-error\">#{error_msg}</div>"

        true ->
          ""
      end

    players_rows =
      if Enum.empty?(players) do
        """
        <tr>
          <td colspan="7" style="text-align: center; color: #8b949e; padding: 40px;">
            No players found in database.
          </td>
        </tr>
        """
      else
        Enum.map(players, fn p ->
          email =
            p.email || "<span style=\"color: #8b949e; font-style: italic;\">Anonymous</span>"

          state_tag =
            if p.has_state do
              "<span class=\"tag tag-success\">Active State</span>"
            else
              "<span class=\"tag tag-warning\">No State</span>"
            end

          token_tag =
            cond do
              not p.has_state ->
                "<span class=\"tag tag-warning\">No State</span>"

              p.has_token ->
                "<span class=\"tag tag-success\">Available</span>"

              true ->
                "<span class=\"tag tag-danger\">Used</span>"
            end

          last_seen =
            if p.last_seen_at do
              Calendar.strftime(p.last_seen_at, "%Y-%m-%d %H:%M:%S UTC")
            else
              "N/A"
            end

          """
          <tr>
            <td><strong>##{p.id}</strong></td>
            <td><strong>#{p.username}</strong></td>
            <td>#{email}</td>
            <td>#{last_seen}</td>
            <td>#{state_tag}</td>
            <td>#{token_tag}</td>
            <td style="display: flex; flex-wrap: wrap; text-align: right; max-width: 16rem; gap: 0.5rem;">
              <form action="/debug/grant_token/#{p.id}" method="post">
                <input type="hidden" name="_csrf_token" value="#{csrf_token}">
                <button type="submit" class="btn btn-secondary btn-action" style="color: #3fb950; border-color: rgba(46, 160, 67, 0.4);">Grant Token</button>
              </form>
              <form action="/debug/full_snapshot/#{p.id}" method="post">
                <input type="hidden" name="_csrf_token" value="#{csrf_token}">
                <button type="submit" class="btn btn-secondary btn-action" style="color: #58a6ff; border-color: rgba(88, 166, 255, 0.4);">Full Snapshot</button>
              </form>
              <a href="/debug/edit/#{p.id}" class="btn btn-primary btn-action">Edit State</a>
              <form action="/debug/delete/#{p.id}" method="post" onsubmit="return confirm('Are you absolutely sure you want to delete player #{p.username}? This will wipe their save state and command logs permanently!');">
                <input type="hidden" name="_csrf_token" value="#{csrf_token}">
                <button type="submit" class="btn btn-danger btn-action">Delete</button>
              </form>
            </td>
          </tr>
          """
        end)
        |> Enum.join("\n")
      end

    current_override = Application.get_env(:incrementalist, :bonustime_rotation_anchor_override)
    active_game_id = Incrementalist.Game.Features.BonusTime.Rules.get_active_game_id()
    rotation_override_display = if(current_override, do: inspect(current_override), else: nil)

    page_html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Incrementalist Admin Debug Console</title>
      #{@css}
    </head>
    <body>
      <div class="container">
        <header>
          <div>
            <h1>Admin Debug Console</h1>
            <p style="color: #8b949e; margin: 5px 0 0 0;">Manage player registrations, audits, and save-state payloads.</p>
          </div>
          <a href="/" class="btn btn-secondary">Back to Game</a>
        </header>

        #{alert_html}

        <!-- Active Daily Game Override -->
        <div class="card" style="margin-bottom: 30px;">
          <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: #ffffff; margin-top: 0; margin-bottom: 10px;">Active Daily Game Override</h2>
          <p style="color: #8b949e; margin-top: 0; margin-bottom: 20px; font-size: 0.9rem;">
            Set which game is active today by shifting the rotation anchor. Changing this affects all players instantly. Currently computed active game: <strong>#{active_game_id}</strong>
            #{if current_override, do: " <span class=\"tag tag-warning\">Overridden</span>", else: " <span class=\"tag tag-success\">Natural Rotation</span>"}
            #{if rotation_override_display, do: "<br><span style=\"font-size: 0.8rem;\">rotation_anchor override: <code>#{rotation_override_display}</code></span>", else: ""}
          </p>
          
          <form action="/debug/set_active_game" method="post" style="display: flex; gap: 12px; align-items: center;">
            <input type="hidden" name="_csrf_token" value="#{csrf_token}">
            
            <div style="flex: 1; max-width: 400px;">
              <select name="game_id" style="width: 100%; background-color: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 10px; font-size: 0.9rem; font-family: 'Inter', sans-serif;">
                <option value="rotation" #{if is_nil(current_override), do: "selected"}>Use Time-Based Natural Rotation</option>
                <option value="chest_draw" #{if current_override && active_game_id == "chest_draw", do: "selected"}>Chest Draw (chest_draw)</option>
                <option value="prize_wheel" #{if current_override && active_game_id == "prize_wheel", do: "selected"}>Prize Wheel (prize_wheel)</option>
                <option value="resource_checklist" #{if current_override && active_game_id == "resource_checklist", do: "selected"}>Resource Checklist (resource_checklist)</option>
                <option value="coin_rain" #{if current_override && active_game_id == "coin_rain", do: "selected"}>Coin Rain (coin_rain)</option>
                <option value="plinko_drop" #{if current_override && active_game_id == "plinko_drop", do: "selected"}>Plinko Drop (plinko_drop)</option>
                <option value="hammer_smash" #{if current_override && active_game_id == "hammer_smash", do: "selected"}>Hammer Smash (hammer_smash)</option>
                <option value="reward_labyrinth" #{if current_override && active_game_id == "reward_labyrinth", do: "selected"}>Reward Labyrinth (reward_labyrinth)</option>
                <option value="ladder_climb" #{if current_override && active_game_id == "ladder_climb", do: "selected"}>Ladder Climb (ladder_climb)</option>
                <option value="card_pick" #{if current_override && active_game_id == "card_pick", do: "selected"}>Card Pick (card_pick)</option>
                <option value="lucky_dice" #{if current_override && active_game_id == "lucky_dice", do: "selected"}>Lucky Dice (lucky_dice)</option>
                <option value="item_checklist" #{if current_override && active_game_id == "item_checklist", do: "selected"}>Item Checklist (item_checklist)</option>
                <option value="scratch_card" #{if current_override && active_game_id == "scratch_card", do: "selected"}>Scratch Card (scratch_card)</option>
                <option value="match_pairs" #{if current_override && active_game_id == "match_pairs", do: "selected"}>Match Pairs (match_pairs)</option>
                <option value="jackpot_meter" #{if current_override && active_game_id == "jackpot_meter", do: "selected"}>Jackpot Meter (jackpot_meter)</option>
                <option value="its_bonus_time" #{if current_override && active_game_id == "its_bonus_time", do: "selected"}>It's Bonus Time (its_bonus_time)</option>
              </select>
            </div>
            
            <button type="submit" class="btn btn-primary">Apply Active Game</button>
          </form>
        </div>

        <div class="card">
          <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: #ffffff; margin-top: 0; margin-bottom: 20px;">Registered Players</h2>
          <table style="width: 100%;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Last Active</th>
                <th>State</th>
                <th>Token</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              #{players_rows}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
    """

    html(conn, page_html)
  end

  # ---------------------------------------------------------------------------
  # Delete Player (Cascading wipes)
  # ---------------------------------------------------------------------------
  def delete(conn, %{"id" => player_id}) do
    player_id = String.to_integer(player_id)

    case Repo.transaction(fn ->
           # 1. Clean up command history
           Repo.delete_all(from gc in GameCommand, where: gc.player_id == ^player_id)
           # 2. Clean up player state
           Repo.delete_all(from ps in PlayerState, where: ps.player_id == ^player_id)
           # 3. Delete player identity
           case Repo.get(Player, player_id) do
             nil -> {:error, "Player not found"}
             player -> Repo.delete!(player)
           end
         end) do
      {:ok, _} ->
        redirect(conn, to: "/debug?success=Player+#{player_id}+successfully+deleted!")

      _ ->
        redirect(conn, to: "/debug?error=Failed+to+delete+player+#{player_id}")
    end
  end

  # ---------------------------------------------------------------------------
  # Edit View: Edit JSON state
  # ---------------------------------------------------------------------------
  def edit(conn, %{"id" => player_id}) do
    player_id = String.to_integer(player_id)
    player = Repo.get!(Player, player_id)

    # Automatically load or initialize the save state!
    ps = PlayerStates.load_or_create(player)

    state_json =
      if ps.state do
        Jason.encode!(ps.state, pretty: true)
      else
        "{}"
      end

    csrf_token = Plug.CSRFProtection.get_csrf_token()

    page_html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Edit Save State - debug</title>
      #{@css}
    </head>
    <body>
      <div class="container">
        <header>
          <div>
            <h1>Edit Player State</h1>
            <p style="color: #8b949e; margin: 5px 0 0 0;">Authoritative player data is validated before commit.</p>
          </div>
          <a href="/debug" class="btn btn-secondary">Back to Index</a>
        </header>

        <div class="breadcrumb">
          <a href="/debug">Debug Index</a> &gt; <strong>Edit Save State for ##{player.id} (#{player.username})</strong>
        </div>

        <div class="card">
          <form action="/debug/update/#{player.id}" method="post">
            <input type="hidden" name="_csrf_token" value="#{csrf_token}">
            
            <div class="form-group">
              <label for="state_json">Raw Save State (JSON)</label>
              <textarea id="state_json" name="state_json">#{state_json}</textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
              <button type="submit" class="btn btn-primary">Save State Payload</button>
              <a href="/debug" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    """

    html(conn, page_html)
  end

  # ---------------------------------------------------------------------------
  # Update Player State (Decodes JSON and runs Ecto changeset validation)
  # ---------------------------------------------------------------------------
  def update(conn, %{"id" => player_id, "state_json" => state_json_str}) do
    player_id = String.to_integer(player_id)
    player = Repo.get!(Player, player_id)
    ps = PlayerStates.load_or_create(player)

    csrf_token = Plug.CSRFProtection.get_csrf_token()

    case Jason.decode(state_json_str) do
      {:ok, parsed_state} ->
        # Ecto changeset casting validation!
        changeset =
          PlayerState.changeset(ps, %{
            state: parsed_state,
            has_bonustime_token:
              Map.get(parsed_state, "has_bonustime_token") || ps.has_bonustime_token,
            last_saved_at: DateTime.utc_now()
          })

        case Repo.update(changeset) do
          {:ok, _updated_ps} ->
            # Keep live in-memory session state aligned with admin DB edits.
            PlayerServer.reload_from_persistence(player.id)
            # Force next browser boot to ignore cache and fetch authoritative snapshot.
            FullSnapshotOverrides.request(player.id)

            redirect(conn,
              to: "/debug?success=State+for+player+#{player.username}+successfully+saved!"
            )

          {:error, changeset_error} ->
            error_details = inspect_changeset_errors(changeset_error)

            error_html = """
            <div class="alert alert-error">
              <strong>Changeset Validation Failed:</strong><br>
              <pre style="margin: 10px 0 0 0; font-family: 'Fira Code', monospace; font-size: 0.85rem;">#{error_details}</pre>
            </div>
            """

            html(conn, edit_error_page(player, state_json_str, error_html, csrf_token))
        end

      {:error, json_error} ->
        error_html = """
        <div class="alert alert-error">
          <strong>Invalid JSON Format:</strong> #{Exception.message(json_error)}
        </div>
        """

        html(conn, edit_error_page(player, state_json_str, error_html, csrf_token))
    end
  end

  # ---------------------------------------------------------------------------
  # Set Active Daily Game Override
  # ---------------------------------------------------------------------------
  def set_active_game(conn, %{"game_id" => game_id}) do
    if game_id == "rotation" do
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)

      redirect(conn,
        to: "/debug?success=Active+daily+game+successfully+reset+to+natural+rotation!"
      )
    else
      case game_slot_index(game_id) do
        {:ok, target_slot_index} ->
          override_anchor =
            compute_rotation_anchor_override_for_slot(target_slot_index) |> Time.iso8601()

          Application.put_env(
            :incrementalist,
            :bonustime_rotation_anchor_override,
            override_anchor
          )

          redirect(
            conn,
            to: "/debug?success=Active+daily+game+successfully+updated+to+#{game_id}!"
          )

        {:error, :unknown_game} ->
          redirect(conn, to: "/debug?error=Unknown+BonusTime+game+id+#{game_id}")
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Grant Daily Play Token
  # ---------------------------------------------------------------------------
  def grant_token(conn, %{"id" => player_id}) do
    player_id = String.to_integer(player_id)
    player = Repo.get!(Player, player_id)
    ps = PlayerStates.load_or_create(player)

    changeset = PlayerState.changeset(ps, %{has_bonustime_token: true})

    case Repo.update(changeset) do
      {:ok, _} ->
        redirect(conn,
          to: "/debug?success=BonusTime+token+successfully+granted+to+#{player.username}!"
        )

      {:error, _} ->
        redirect(conn, to: "/debug?error=Failed+to+grant+BonusTime+token+to+#{player.username}")
    end
  end

  # ---------------------------------------------------------------------------
  # Force Full Snapshot On Next Boot
  # ---------------------------------------------------------------------------
  def full_snapshot(conn, %{"id" => player_id}) do
    player_id = String.to_integer(player_id)
    player = Repo.get!(Player, player_id)

    FullSnapshotOverrides.request(player.id)

    redirect(
      conn,
      to:
        "/debug?success=Full+snapshot+queued+for+#{player.username}.+Next+reconnect+will+ignore+client+cache."
    )
  end

  # Helper to pretty print changeset errors for deep embedded schemas
  defp inspect_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Jason.encode!(pretty: true)
  end

  defp game_slot_index(game_id) when is_binary(game_id) do
    rotation = Incrementalist.Game.Constants.bonustime_rotation()

    case Enum.find(rotation, fn {_slot, id} -> id == game_id end) do
      {slot_index_str, ^game_id} ->
        {:ok, String.to_integer(slot_index_str)}

      nil ->
        {:error, :unknown_game}
    end
  end

  defp compute_rotation_anchor_override_for_slot(target_slot_index)
       when is_integer(target_slot_index) do
    now_ms = Time.now() |> Time.to_unix_ms()
    slot_ms = Incrementalist.Game.Constants.bonustime_slot_ms()
    slot_count = Incrementalist.Game.Constants.bonustime_rotation_slot_count()
    anchor_ms = Incrementalist.Game.Constants.bonustime_rotation_anchor_at() |> Time.to_unix_ms()

    elapsed = max(0, now_ms - anchor_ms)
    boundary_index = div(elapsed, slot_ms)
    current_slot_index = rem(boundary_index, slot_count) + 1
    slot_delta = target_slot_index - current_slot_index
    override_anchor_ms = anchor_ms - slot_delta * slot_ms

    DateTime.from_unix!(override_anchor_ms, :millisecond)
  end

  # Re-render edit form with correct params on error
  defp edit_error_page(player, state_json_str, error_html, csrf_token) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Edit Save State - debug</title>
      #{@css}
    </head>
    <body>
      <div class="container">
        <header>
          <div>
            <h1>Edit Player State</h1>
            <p style="color: #8b949e; margin: 5px 0 0 0;">Authoritative player data is validated before commit.</p>
          </div>
          <a href="/debug" class="btn btn-secondary">Back to Index</a>
        </header>

        <div class="breadcrumb">
          <a href="/debug">Debug Index</a> &gt; <strong>Edit Save State for ##{player.id} (#{player.username})</strong>
        </div>

        #{error_html}

        <div class="card">
          <form action="/debug/update/#{player.id}" method="post">
            <input type="hidden" name="_csrf_token" value="#{csrf_token}">
            
            <div class="form-group">
              <label for="state_json">Raw Save State (JSON)</label>
              <textarea id="state_json" name="state_json">#{state_json_str}</textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
              <button type="submit" class="btn btn-primary">Save State Payload</button>
              <a href="/debug" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    """
  end
end
