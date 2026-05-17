defmodule BigNum do
  @moduledoc """
  High-precision large number representation (m * 10^e).
  Maintains 15 digits of precision.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @precision_digits 15
  @add_cutoff @precision_digits + 1

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :m, :float, default: 0.0
    field :e, :integer, default: 0
  end

  def changeset(schema \\ %__MODULE__{}, attrs) do
    schema
    |> cast(attrs, [:m, :e])
    |> validate_required([:m, :e])
  end

  def zero, do: %BigNum{m: 0.0, e: 0}
  def one, do: %BigNum{m: 1.0, e: 0}

  @doc """
  Normalizes a BigNum so that 1 <= abs(m) < 10.
  """
  def normalize(%BigNum{m: m}) when m == 0.0, do: %BigNum{m: 0.0, e: 0}

  def normalize(%BigNum{m: m, e: e}) do
    shift = Float.floor(:math.log10(abs(m))) |> trunc()

    m = m / :math.pow(10, shift)
    e = e + shift

    {m, e} =
      cond do
        abs(m) >= 10 ->
          {m / 10, e + 1}

        abs(m) < 1 ->
          {m * 10, e - 1}

        true ->
          {m, e}
      end

    # Keep roughly 15 significant digits
    m =
      m
      |> :erlang.float_to_binary(decimals: @precision_digits - 1)
      |> String.to_float()

    {m, e} =
      if abs(m) >= 10 do
        {m / 10, e + 1}
      else
        {m, e}
      end

    %BigNum{m: m, e: e}
  end

  def from_number(v) when v == 0, do: zero()

  def from_number(value) when is_number(value) do
    normalize(%BigNum{m: value * 1.0, e: 0})
  end

  def new(m, e) do
    normalize(%BigNum{m: m * 1.0, e: e})
  end

  @doc """
  Converts a BigNum to a native float.
  Warning: May return :inf or 0.0 if outside double-precision range.
  """
  def to_float(%BigNum{m: m, e: e}) do
    m * :math.pow(10, e)
  end

  def mul(%BigNum{m: m}, _b) when m == 0.0, do: zero()
  def mul(_a, %BigNum{m: m}) when m == 0.0, do: zero()

  def mul(%BigNum{} = a, %BigNum{} = b) do
    normalize(%BigNum{
      m: a.m * b.m,
      e: a.e + b.e
    })
  end

  def div(_a, %BigNum{m: m}) when m == 0.0 do
    raise ArithmeticError, message: "division by zero"
  end

  def div(%BigNum{m: m}, _b) when m == 0.0, do: zero()

  def div(%BigNum{} = a, %BigNum{} = b) do
    normalize(%BigNum{
      m: a.m / b.m,
      e: a.e - b.e
    })
  end

  def add(%BigNum{m: m}, b) when m == 0.0, do: b
  def add(a, %BigNum{m: m}) when m == 0.0, do: a

  def add(%BigNum{} = a, %BigNum{} = b) do
    diff = a.e - b.e

    cond do
      diff > @add_cutoff ->
        a

      diff < -@add_cutoff ->
        b

      true ->
        {upper, lower, abs_diff} =
          if diff < 0 do
            {b, a, -diff}
          else
            {a, b, diff}
          end

        normalize(%BigNum{
          m: upper.m + lower.m * :math.pow(10, -abs_diff),
          e: upper.e
        })
    end
  end

  def sub(%BigNum{m: m}, %BigNum{} = b) when m == 0.0, do: %BigNum{m: -b.m, e: b.e}
  def sub(%BigNum{} = a, %BigNum{m: m}) when m == 0.0, do: a

  def sub(%BigNum{} = a, %BigNum{} = b) do
    diff = a.e - b.e

    cond do
      diff > @add_cutoff -> a
      diff < -@add_cutoff -> %BigNum{m: -b.m, e: b.e}
      true -> add(a, %BigNum{m: -b.m, e: b.e})
    end
  end

  def pow(%BigNum{m: m}, _p) when m == 0.0, do: zero()

  def pow(%BigNum{} = a, p) when is_number(p) do
    if a.m < 0 and p != trunc(p) do
      raise ArithmeticError, message: "cannot raise negative number to non-integer power"
    end

    log10_value = :math.log10(abs(a.m)) + a.e
    result_log = log10_value * p

    e = Float.floor(result_log) |> trunc()
    m = :math.pow(10, result_log - e)

    m =
      if a.m < 0 and rem(trunc(p), 2) != 0 do
        -m
      else
        m
      end

    normalize(%BigNum{m: m, e: e})
  end

  def compare(%BigNum{m: m1}, %BigNum{m: m2}) when m1 == 0.0 and m2 == 0.0, do: 0
  def compare(%BigNum{m: m1}, %BigNum{m: m2}) when m1 >= 0 and m2 < 0, do: 1
  def compare(%BigNum{m: m1}, %BigNum{m: m2}) when m1 < 0 and m2 >= 0, do: -1

  def compare(%BigNum{} = a, %BigNum{} = b) do
    sign = if a.m < 0, do: -1, else: 1

    cond do
      a.e > b.e -> sign
      a.e < b.e -> -sign
      abs(a.m) > abs(b.m) -> sign
      abs(a.m) < abs(b.m) -> -sign
      true -> 0
    end
  end

  def format(%BigNum{m: m}) when m == 0.0, do: "0"

  def format(%BigNum{} = n) do
    mantissa = :erlang.float_to_binary(n.m, decimals: @precision_digits - 1)
    "#{mantissa}e#{n.e}"
  end
end
