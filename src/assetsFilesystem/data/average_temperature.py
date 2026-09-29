def average_temperature_for_year(filename):
    with open(filename) as f:
        temperatures = [float(line) for line in f if line.strip()]
    return sum(temperatures) / len(temperatures)


if __name__ == "__main__":
    average = average_temperature_for_year("london-temperature-2025.txt")
    print(average)
