defmodule Incrementalist.Game.Notices do
  @moduledoc """
  Tracks notification state for the player.
  Stored in a separate column from gameplay state to keep concerns separated.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :seen_leaf_ids, {:array, :string}, default: []
    # Parent ID -> Level when acknowledged
    field :last_ack_level, :map, default: %{}
    # Parent ID -> ISO8601 timestamp when acknowledged
    field :last_ack_time, :map, default: %{}
  end

  def changeset(schema \\ %__MODULE__{}, attrs) do
    schema
    |> cast(attrs, [:seen_leaf_ids, :last_ack_level, :last_ack_time])
  end

  def new() do
    %__MODULE__{
      seen_leaf_ids: [],
      last_ack_level: %{},
      last_ack_time: %{}
    }
  end

  def see(notices, leaf_id, _level, _time) do
    seen_leaf_ids = Enum.uniq([leaf_id | notices.seen_leaf_ids])
    
    # Bubbling clear: when a leaf is seen, we also acknowledge its parents.
    # Note: The client is responsible for knowing which parents to acknowledge
    # or the server can have a map. For now, let's let the command specify
    # if it should clear parents, but usually a leaf interaction implies parent acknowledgement.
    %{notices | seen_leaf_ids: seen_leaf_ids}
  end

  def ack(notices, parent_id, level, time) do
    last_ack_level = Map.put(notices.last_ack_level, to_string(parent_id), level)
    last_ack_time = Map.put(notices.last_ack_time, to_string(parent_id), time)
    
    %{notices | last_ack_level: last_ack_level, last_ack_time: last_ack_time}
  end
end
