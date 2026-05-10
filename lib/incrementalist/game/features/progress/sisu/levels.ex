defmodule Incrementalist.Game.Features.Progress.Sisu.Levels do
  @moduledoc false

  @base_max 2.0
  @per_level 0.5

  @early_base 2.5e3
  @early_block_size 3
  @early_max_level 12
  @early_multipliers [1.0, 2.0, 4.0]

  @late_start_level 13
  @late_exponent_start 7
  @late_exponent_end 299
  @late_mantissas [1.5, 2.25, 3.25, 4.5, 6.5, 9.5]

  @late_levels_per_exponent length(@late_mantissas)

  @max_upgrade_level @early_max_level +
                       (@late_exponent_end - @late_exponent_start + 1) * @late_levels_per_exponent

  def base_max, do: @base_max
  def per_level, do: @per_level
  def max_upgrade_level, do: @max_upgrade_level

  def upgrade_cost(level) when is_integer(level) and level <= 0, do: 0

  def upgrade_cost(level) when is_integer(level) and level <= @early_max_level do
    exponent_shift = div(level - 1, @early_block_size)
    multiplier = Enum.at(@early_multipliers, rem(level - 1, @early_block_size))
    @early_base * multiplier * :math.pow(10.0, exponent_shift)
  end

  def upgrade_cost(level) when is_integer(level) and level <= @max_upgrade_level do
    offset = level - @late_start_level
    exponent = @late_exponent_start + div(offset, @late_levels_per_exponent)
    mantissa = Enum.at(@late_mantissas, rem(offset, @late_levels_per_exponent))
    mantissa * :math.pow(10.0, exponent)
  end

  def upgrade_cost(_level), do: nil
end
