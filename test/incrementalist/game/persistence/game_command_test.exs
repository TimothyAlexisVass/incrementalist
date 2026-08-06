defmodule Incrementalist.Game.Persistence.GameCommandTest do
  use Incrementalist.DataCase, async: true

  alias Incrementalist.Game.Persistence.GameCommand
  alias Incrementalist.Game.Constants

  @valid_attrs %{
    player_id: 1,
    command_id: 0,
    sequence: 1,
    command_type: "game.test",
    intent: %{"foo" => "bar"},
    status: "queued",
    queued_at: DateTime.utc_now(),
    replay_count: 0
  }

  describe "changeset/2" do
    test "returns a valid changeset when given valid attributes" do
      changeset = GameCommand.changeset(%GameCommand{}, @valid_attrs)
      assert changeset.valid?
    end

    test "requires player_id, command_id, sequence, command_type, intent, status, queued_at" do
      # Note: intent and status have default values in the schema,
      # but if they are explicitly missing when cast, validate_required won't flag them
      # if we start with an empty struct that populates defaults.
      # Instead we use %GameCommand{} and cast an empty map.
      # The `validate_required` will flag fields that are nil.
      # Since `intent` defaults to `%{}` and `status` to `"queued"`,
      # they are actually present and won't be blank!
      # We need to test passing nil explicitly to see them fail validate_required.
      attrs_with_nils = %{
        player_id: nil,
        command_id: nil,
        sequence: nil,
        command_type: nil,
        intent: nil,
        status: nil,
        queued_at: nil
      }

      changeset = GameCommand.changeset(%GameCommand{}, attrs_with_nils)
      refute changeset.valid?

      errors = errors_on(changeset)

      assert %{
               player_id: ["can't be blank"],
               command_id: ["can't be blank"],
               sequence: ["can't be blank"],
               command_type: ["can't be blank"],
               intent: ["can't be blank"],
               status: ["can't be blank"],
               queued_at: ["can't be blank"]
             } = errors
    end

    test "validates status inclusion" do
      attrs = %{@valid_attrs | status: "invalid_status"}
      changeset = GameCommand.changeset(%GameCommand{}, attrs)
      refute changeset.valid?

      assert %{status: ["is invalid"]} = errors_on(changeset)
    end

    test "validates command_id boundaries (>= 0, < Constants.max_queued_commands())" do
      # Less than 0
      attrs = %{@valid_attrs | command_id: -1}
      changeset = GameCommand.changeset(%GameCommand{}, attrs)
      refute changeset.valid?
      assert %{command_id: ["must be greater than or equal to 0"]} = errors_on(changeset)

      # Equal to Constants.max_queued_commands()
      max_command = Constants.max_queued_commands()
      attrs = %{@valid_attrs | command_id: max_command}
      changeset = GameCommand.changeset(%GameCommand{}, attrs)
      refute changeset.valid?
      expected_message = "must be less than #{max_command}"
      assert %{command_id: [^expected_message]} = errors_on(changeset)

      # Valid bounds
      attrs = %{@valid_attrs | command_id: 0}
      assert GameCommand.changeset(%GameCommand{}, attrs).valid?

      attrs = %{@valid_attrs | command_id: max_command - 1}
      assert GameCommand.changeset(%GameCommand{}, attrs).valid?
    end

    test "validates sequence is greater than 0" do
      attrs = %{@valid_attrs | sequence: 0}
      changeset = GameCommand.changeset(%GameCommand{}, attrs)
      refute changeset.valid?
      assert %{sequence: ["must be greater than 0"]} = errors_on(changeset)
    end

    test "validates replay_count is greater than or equal to 0" do
      attrs = %{@valid_attrs | replay_count: -1}
      changeset = GameCommand.changeset(%GameCommand{}, attrs)
      refute changeset.valid?
      assert %{replay_count: ["must be greater than or equal to 0"]} = errors_on(changeset)

      attrs = %{@valid_attrs | replay_count: 0}
      assert GameCommand.changeset(%GameCommand{}, attrs).valid?
    end
  end
end
