defmodule Incrementalist.Game.Persistence.GameCommand do
  @moduledoc """
  Durable command queue row.

  Status meanings:
  - `queued`: stored intent, no game rules have run.
  - `succeeded` or `failed`: rules ran once and `result` is ready for the client.
  - `acked`: the client reported that the processed result was applied.

  `command_id` is the client's ten-slot queue index, 0 through 9, and is unique
  only among that player's unacked commands. `sequence` remains the server's
  FIFO ordering.

  `result` is part of the durability model, not a cache. It is what reconnect
  replay returns while a processed row remains unacknowledged.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Persistence.{Player, SaveSlot}

  @statuses ~w(queued succeeded failed acked)

  schema "game_commands" do
    field :command_id, :integer
    field :sequence, :integer
    field :command_type, :string
    field :intent, :map, default: %{}
    field :status, :string, default: "queued"
    field :result, :map
    field :queued_at, :utc_datetime_usec
    field :processed_at, :utc_datetime_usec
    field :acked_at, :utc_datetime_usec
    field :replay_count, :integer, default: 0

    belongs_to :player, Player
    belongs_to :save_slot, SaveSlot

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(game_command, attrs) do
    game_command
    |> cast(attrs, [
      :player_id,
      :save_slot_id,
      :command_id,
      :sequence,
      :command_type,
      :intent,
      :status,
      :result,
      :queued_at,
      :processed_at,
      :acked_at,
      :replay_count
    ])
    |> validate_required([
      :player_id,
      :command_id,
      :sequence,
      :command_type,
      :intent,
      :status,
      :queued_at
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:command_id, greater_than_or_equal_to: 0, less_than: Constants.max_queued_commands())
    |> validate_number(:sequence, greater_than: 0)
    |> validate_number(:replay_count, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:player_id)
    |> foreign_key_constraint(:save_slot_id)
    |> unique_constraint(:command_id, name: :game_commands_player_id_command_id_unacked_index)
    |> unique_constraint([:player_id, :sequence])
  end
end
