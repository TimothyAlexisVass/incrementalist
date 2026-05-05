defmodule Incrementalist.Game.Persistence.GameCommand do
  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Persistence.{Player, SaveSlot}

  @statuses ~w(queued succeeded failed acked)

  schema "game_commands" do
    field :sequence, :integer
    field :command_type, :string
    field :intent, :map, default: %{}
    field :status, :string, default: "queued"
    field :result, :map
    field :state_version, :integer
    field :queued_at, :utc_datetime
    field :processed_at, :utc_datetime
    field :acked_at, :utc_datetime
    field :replay_count, :integer, default: 0

    belongs_to :player, Player
    belongs_to :save_slot, SaveSlot

    timestamps(type: :utc_datetime)
  end

  def changeset(game_command, attrs) do
    game_command
    |> cast(attrs, [
      :player_id,
      :save_slot_id,
      :sequence,
      :command_type,
      :intent,
      :status,
      :result,
      :state_version,
      :queued_at,
      :processed_at,
      :acked_at,
      :replay_count
    ])
    |> validate_required([:player_id, :sequence, :command_type, :intent, :status, :queued_at])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:sequence, greater_than: 0)
    |> validate_number(:replay_count, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:player_id)
    |> foreign_key_constraint(:save_slot_id)
    |> unique_constraint([:player_id, :sequence])
  end
end
