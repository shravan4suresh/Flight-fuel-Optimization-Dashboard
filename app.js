const FUEL_PRICE_PER_KG = 0.86;
const CO2_PER_KG_FUEL = 3.16;
const TAXI_BASELINE_MINUTES = 14;
const palette = {
  teal: "#0d766d",
  blue: "#2563eb",
  amber: "#c76a1b",
  green: "#16803f",
  red: "#b42318",
  gray: "#60706b"
};

const charts = {};
const DATA_URL = "data/sample_flight_data.csv";
let currentDataSignature = "";
let allData = [];
let currentData = [];
let scenarioListenerReady = false;
let filtersReady = false;
let activeFilters = {
  airport: "SIN",
  airline: "All Airlines"
};

document.addEventListener("DOMContentLoaded", async () => {
  setupRefreshButton();
  setupFilterControls();
  await refreshDashboardData({ force: true, silent: true });
});

async function refreshDashboardData({ force = false, silent = false } = {}) {
  const button = document.getElementById("refreshDataButton");
  try {
    if (button) button.disabled = true;
    setRefreshStatus(silent ? "Loading sample aviation data..." : "Checking for updated CSV data...");

    const { data, signature } = await loadFlightData({ cacheBust: true });
    if (!force && signature === currentDataSignature) {
      setRefreshStatus(`No newer CSV found | Last checked ${formatRefreshTime(new Date())}`);
      return;
    }

    currentDataSignature = signature;
    allData = data.map((row, index) => ({
      ...row,
      predicted_taxi_out_time_minutes: predictTaxiOut(row, index)
    }));
    populateFilterOptions(allData);
    currentData = applyFilters(allData);

    renderDashboard(currentData);
    updateFilterSummary();
    const action = force ? "Loaded" : "Refreshed";
    setRefreshStatus(`${action} ${currentData.length.toLocaleString()} of ${allData.length.toLocaleString()} records | ${formatRefreshTime(new Date())}`);
  } catch (error) {
    setRefreshStatus("Unable to refresh data. Check the CSV file path.");
    console.error(error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadFlightData({ cacheBust = false } = {}) {
  const url = cacheBust ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CSV request failed with status ${response.status}`);
  }
  const text = await response.text();
  return {
    signature: text.trim(),
    data: parseCsv(text).map((row) => ({
      ...row,
      passenger_demand_index: Number(row.passenger_demand_index),
      taxi_out_time_minutes: Number(row.taxi_out_time_minutes),
      departure_delay_minutes: Number(row.departure_delay_minutes),
      wind_speed: Number(row.wind_speed),
      visibility: Number(row.visibility),
      wind_direction_degrees: Number(row.wind_direction_degrees),
      runway_heading_degrees: Number(row.runway_heading_degrees),
      headwind_component_knots: Number(row.headwind_component_knots),
      tailwind_component_knots: Number(row.tailwind_component_knots),
      crosswind_component_knots: Number(row.crosswind_component_knots),
      airport_congestion_level: Number(row.airport_congestion_level),
      fuel_burn_rate_kg_per_minute: Number(row.fuel_burn_rate_kg_per_minute),
      estimated_extra_fuel_kg: Number(row.estimated_extra_fuel_kg),
      estimated_co2_kg: Number(row.estimated_co2_kg)
    }))
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return headers.reduce((record, header, index) => {
      record[header] = values[index];
      return record;
    }, {});
  });
}

function predictTaxiOut(row, index) {
  const weatherPenalty = {
    Clear: 0,
    Cloudy: 1.4,
    Rain: 3.1,
    Fog: 4.8,
    Thunderstorm: 6.2,
    Snow: 5.4
  }[row.weather_condition] || 0;
  const airportPenalty = {
    JFK: 3.4,
    LAX: 2.6,
    ORD: 2.9,
    ATL: 2.1,
    DFW: 1.7,
    SFO: 2.8,
    SIN: 2.0
  }[row.departure_airport] || 1.5;
  const aircraftPenalty = row.aircraft_type.includes("777") || row.aircraft_type.includes("A350") ? 1.4 : 0.6;
  const demandPenalty = Math.max(0, row.passenger_demand_index - 70) * 0.055;
  const deterministicNoise = ((index % 7) - 3) * 0.42;
  const prediction = 9.5
    + row.airport_congestion_level * 2.15
    + row.departure_delay_minutes * 0.09
    + Math.max(0, 8 - row.visibility) * 0.75
    + row.headwind_component_knots * -0.04
    + row.tailwind_component_knots * 0.28
    + row.crosswind_component_knots * 0.11
    + weatherPenalty
    + airportPenalty
    + aircraftPenalty
    + demandPenalty
    + deterministicNoise;
  return Number(prediction.toFixed(1));
}

function renderMetrics(data) {
  const totalFuel = sum(data, "estimated_extra_fuel_kg");
  const totalCo2 = sum(data, "estimated_co2_kg");
  const avgTaxi = average(data, "taxi_out_time_minutes");
  const avgTailwind = average(data, "tailwind_component_knots");
  const peakData = data.filter((row) => row.travel_season === "Peak");
  const offPeakData = data.filter((row) => row.travel_season === "Off-Peak");
  const mae = average(data.map((row) => ({ error: Math.abs(row.predicted_taxi_out_time_minutes - row.taxi_out_time_minutes) })), "error");
  const rmse = Math.sqrt(average(data.map((row) => ({ error: (row.predicted_taxi_out_time_minutes - row.taxi_out_time_minutes) ** 2 })), "error"));
  const r2 = calculateR2(data);

  setText("metricFlights", data.length.toLocaleString());
  setText("metricTaxi", `${avgTaxi.toFixed(1)} min`);
  setText("metricFuel", `${Math.round(totalFuel).toLocaleString()} kg`);
  setText("metricCo2", `${Math.round(totalCo2).toLocaleString()} kg`);
  setText("metricTailwind", `${avgTailwind.toFixed(1)} kt`);
  setText("metricSelectedAirport", activeFilters.airport || "All");
  setText("metricSinPeakTaxi", `${average(peakData, "taxi_out_time_minutes").toFixed(1)} min`);
  setText("metricSinOffPeakTaxi", `${average(offPeakData, "taxi_out_time_minutes").toFixed(1)} min`);
  setText("metricSinDemand", average(peakData, "passenger_demand_index").toFixed(0));
  setText("metricCost", `$${Math.round(totalFuel * FUEL_PRICE_PER_KG).toLocaleString()}`);
  setText("metricMae", `${mae.toFixed(1)} min`);
  setText("metricRmse", `${rmse.toFixed(1)} min`);
  setText("metricR2", r2.toFixed(2));
}

function renderCharts(data) {
  renderTaxiTrend(data);
  renderAirportRunway(data);
  renderWeather(data);
  renderCongestionFuel(data);
  renderWindComponents(data);
  renderChangiSeason(data);
  renderFuelSaving(data);
  renderCo2Saving(data);
  renderPredictedActual(data);
}

function renderDashboard(data) {
  renderMetrics(data);
  renderCharts(data);
  renderSampleRows(data);
  if (!scenarioListenerReady) {
    setupScenario(data);
    scenarioListenerReady = true;
  } else {
    updateScenario(data);
  }
}

function renderTaxiTrend(data) {
  const grouped = groupAverage(data, "flight_date", "taxi_out_time_minutes");
  makeChart("taxiTrendChart", {
    type: "line",
    data: {
      labels: grouped.map((row) => row.key),
      datasets: [{
        label: "Average taxi-out minutes",
        data: grouped.map((row) => row.value),
        borderColor: palette.teal,
        backgroundColor: "rgba(13, 118, 109, 0.12)",
        fill: true,
        tension: 0.32,
        pointRadius: 3
      }]
    },
    options: chartOptions("Flight date", "Minutes")
  });
}

function renderAirportRunway(data) {
  const grouped = groupAverage(data, (row) => `${row.departure_airport} ${row.runway}`, "taxi_out_time_minutes")
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  makeChart("airportRunwayChart", {
    type: "bar",
    data: {
      labels: grouped.map((row) => row.key),
      datasets: [{
        label: "Average taxi-out minutes",
        data: grouped.map((row) => row.value),
        backgroundColor: palette.blue
      }]
    },
    options: chartOptions("Airport and runway", "Minutes")
  });
}

function renderWeather(data) {
  const grouped = groupAverage(data, "weather_condition", "taxi_out_time_minutes")
    .sort((a, b) => a.value - b.value);
  const weatherColors = {
    Clear: palette.green,
    Cloudy: palette.teal,
    Rain: palette.blue,
    Fog: palette.amber,
    Snow: palette.gray,
    Thunderstorm: palette.red
  };
  makeChart("weatherChart", {
    type: "bar",
    data: {
      labels: grouped.map((row) => row.key),
      datasets: [{
        label: "Average taxi-out minutes",
        data: grouped.map((row) => row.value),
        backgroundColor: grouped.map((row) => weatherColors[row.key] || palette.gray)
      }]
    },
    options: chartOptions("Weather condition", "Minutes")
  });
}

function renderWindComponents(data) {
  const grouped = groupAverage(data, tailwindBucket, "taxi_out_time_minutes");
  const order = ["No tailwind", "Light tailwind", "Moderate tailwind", "High tailwind"];
  const ordered = order.map((key) => grouped.find((row) => row.key === key)).filter(Boolean);
  makeChart("windComponentChart", {
    type: "bar",
    data: {
      labels: ordered.map((row) => row.key),
      datasets: [
        {
          label: "Average taxi-out minutes",
          data: ordered.map((row) => row.value),
          backgroundColor: palette.blue,
          yAxisID: "y"
        },
        {
          label: "Average crosswind knots",
          data: ordered.map((row) => average(data.filter((flight) => tailwindBucket(flight) === row.key), "crosswind_component_knots")),
          backgroundColor: palette.amber,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartOptions("Tailwind component bucket", "Taxi-out minutes"),
      scales: {
        x: chartOptions("Tailwind component bucket", "Taxi-out minutes").scales.x,
        y: chartOptions("Tailwind component bucket", "Taxi-out minutes").scales.y,
        y1: {
          position: "right",
          title: { display: true, text: "Crosswind knots" },
          grid: { drawOnChartArea: false },
          ticks: { color: "#60706b" },
          beginAtZero: true
        }
      }
    }
  });
}

function renderChangiSeason(data) {
  const order = ["Off-Peak", "Peak"];
  const seasonTaxi = groupAverage(data, "travel_season", "taxi_out_time_minutes");
  const seasonDelay = groupAverage(data, "travel_season", "departure_delay_minutes");
  const seasonFuel = groupSum(data, "travel_season", "estimated_extra_fuel_kg");
  const seasonCo2 = groupSum(data, "travel_season", "estimated_co2_kg");

  makeChart("changiSeasonChart", {
    type: "bar",
    data: {
      labels: order,
      datasets: [
        {
          label: "Average taxi-out minutes",
          data: valuesForOrder(seasonTaxi, order),
          backgroundColor: palette.teal
        },
        {
          label: "Average departure delay minutes",
          data: valuesForOrder(seasonDelay, order),
          backgroundColor: palette.blue
        }
      ]
    },
    options: chartOptions("Travel season", "Minutes")
  });

  makeChart("changiImpactChart", {
    type: "bar",
    data: {
      labels: order,
      datasets: [
        {
          label: "Extra fuel kg",
          data: valuesForOrder(seasonFuel, order),
          backgroundColor: palette.amber,
          yAxisID: "y"
        },
        {
          label: "CO2 kg",
          data: valuesForOrder(seasonCo2, order),
          backgroundColor: palette.gray,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartOptions("Travel season", "Fuel kg"),
      scales: {
        x: chartOptions("Travel season", "Fuel kg").scales.x,
        y: chartOptions("Travel season", "Fuel kg").scales.y,
        y1: {
          position: "right",
          title: { display: true, text: "CO2 kg" },
          grid: { drawOnChartArea: false },
          ticks: { color: "#60706b" },
          beginAtZero: true
        }
      }
    }
  });
}

function renderCongestionFuel(data) {
  makeChart("congestionFuelChart", {
    type: "scatter",
    data: {
      datasets: [{
        label: "Flights",
        data: data.map((row) => ({
          x: row.airport_congestion_level,
          y: row.estimated_extra_fuel_kg
        })),
        backgroundColor: "rgba(199, 106, 27, 0.68)",
        borderColor: palette.amber,
        pointRadius: 5
      }]
    },
    options: chartOptions("Congestion level", "Extra fuel kg")
  });
}

function renderFuelSaving(data) {
  const grouped = groupSum(data, "departure_airport", "estimated_extra_fuel_kg")
    .sort((a, b) => b.value - a.value);
  makeChart("fuelSavingChart", {
    type: "bar",
    data: {
      labels: grouped.map((row) => row.key),
      datasets: [
        {
          label: "Observed extra fuel kg",
          data: grouped.map((row) => row.value),
          backgroundColor: palette.amber
        },
        {
          label: "Potential saving kg at 18%",
          data: grouped.map((row) => row.value * 0.18),
          backgroundColor: palette.green
        }
      ]
    },
    options: chartOptions("Departure airport", "Fuel kg")
  });
}

function renderCo2Saving(data) {
  const grouped = groupSum(data, "departure_airport", "estimated_co2_kg")
    .sort((a, b) => b.value - a.value);
  makeChart("co2SavingChart", {
    type: "bar",
    data: {
      labels: grouped.map((row) => row.key),
      datasets: [
        {
          label: "Observed CO2 kg",
          data: grouped.map((row) => row.value),
          backgroundColor: palette.gray
        },
        {
          label: "Avoided CO2 kg at 18%",
          data: grouped.map((row) => row.value * 0.18),
          backgroundColor: palette.teal
        }
      ]
    },
    options: chartOptions("Departure airport", "CO2 kg")
  });
}

function renderPredictedActual(data) {
  makeChart("predictedActualChart", {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Predicted vs actual",
          data: data.map((row) => ({
            x: row.taxi_out_time_minutes,
            y: row.predicted_taxi_out_time_minutes
          })),
          backgroundColor: "rgba(37, 99, 235, 0.7)",
          pointRadius: 5
        },
        {
          label: "Ideal fit",
          type: "line",
          data: [{ x: 12, y: 12 }, { x: 42, y: 42 }],
          borderColor: palette.teal,
          borderDash: [6, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: chartOptions("Actual taxi-out minutes", "Predicted taxi-out minutes")
  });
}

function setupScenario(data) {
  const range = document.getElementById("reductionRange");
  range.addEventListener("input", () => updateScenario(currentData));
  updateScenario(data);
}

function updateScenario(data) {
  const range = document.getElementById("reductionRange");
  const reduction = Number(range.value) / 100;
  const fuelSaved = sum(data, "estimated_extra_fuel_kg") * reduction;
  setText("reductionValue", range.value);
  setText("scenarioFuel", `${Math.round(fuelSaved).toLocaleString()} kg`);
  setText("scenarioCost", `$${Math.round(fuelSaved * FUEL_PRICE_PER_KG).toLocaleString()}`);
  setText("scenarioCo2", `${Math.round(fuelSaved * CO2_PER_KG_FUEL).toLocaleString()} kg`);
}

function renderSampleRows(data) {
  const rows = data.slice(0, 10).map((row) => `
    <tr>
      <td>${row.flight_date}</td>
      <td>${row.travel_season}</td>
      <td>${row.departure_airport}</td>
      <td>${row.airline}</td>
      <td>${row.aircraft_type}</td>
      <td>${row.runway}</td>
      <td>${row.weather_condition}</td>
      <td>${row.tailwind_component_knots.toFixed(1)} kt</td>
      <td>${row.crosswind_component_knots.toFixed(1)} kt</td>
      <td>${row.taxi_out_time_minutes} min</td>
      <td>${row.estimated_extra_fuel_kg} kg</td>
      <td>${row.estimated_co2_kg} kg</td>
    </tr>
  `).join("");
  document.getElementById("sampleRows").innerHTML = rows;
}

function valuesForOrder(grouped, order) {
  return order.map((key) => grouped.find((row) => row.key === key)?.value || 0);
}

function tailwindBucket(row) {
  if (row.tailwind_component_knots >= 12) return "High tailwind";
  if (row.tailwind_component_knots >= 6) return "Moderate tailwind";
  if (row.tailwind_component_knots > 0) return "Light tailwind";
  return "No tailwind";
}

function makeChart(canvasId, config) {
  const context = document.getElementById(canvasId);
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(context, config);
}

function chartOptions(xTitle, yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          boxWidth: 12,
          color: "#17201d"
        }
      },
      tooltip: {
        backgroundColor: "#17201d",
        padding: 12
      }
    },
    scales: {
      x: {
        title: { display: true, text: xTitle },
        grid: { color: "rgba(216, 223, 220, 0.7)" },
        ticks: { color: "#60706b" }
      },
      y: {
        title: { display: true, text: yTitle },
        grid: { color: "rgba(216, 223, 220, 0.7)" },
        ticks: { color: "#60706b" },
        beginAtZero: false
      }
    }
  };
}

function groupAverage(data, keySelector, valueKey) {
  const grouped = groupValues(data, keySelector, valueKey);
  return Object.entries(grouped).map(([key, values]) => ({
    key,
    value: Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1))
  }));
}

function groupSum(data, keySelector, valueKey) {
  const grouped = groupValues(data, keySelector, valueKey);
  return Object.entries(grouped).map(([key, values]) => ({
    key,
    value: Number(values.reduce((total, value) => total + value, 0).toFixed(1))
  }));
}

function groupValues(data, keySelector, valueKey) {
  return data.reduce((groups, row) => {
    const key = typeof keySelector === "function" ? keySelector(row) : row[keySelector];
    if (!groups[key]) groups[key] = [];
    groups[key].push(Number(row[valueKey]));
    return groups;
  }, {});
}

function calculateR2(data) {
  if (data.length < 2) return 0;
  const meanActual = average(data, "taxi_out_time_minutes");
  const ssTotal = data.reduce((total, row) => total + (row.taxi_out_time_minutes - meanActual) ** 2, 0);
  if (ssTotal === 0) return 0;
  const ssResidual = data.reduce((total, row) => total + (row.taxi_out_time_minutes - row.predicted_taxi_out_time_minutes) ** 2, 0);
  return 1 - ssResidual / ssTotal;
}

function sum(data, key) {
  return data.reduce((total, row) => total + Number(row[key]), 0);
}

function average(data, key) {
  if (!data.length) return 0;
  return sum(data, key) / data.length;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function setupRefreshButton() {
  const button = document.getElementById("refreshDataButton");
  if (!button) return;
  button.addEventListener("click", () => refreshDashboardData());
}

function setRefreshStatus(message) {
  const status = document.getElementById("dataRefreshStatus");
  if (status) status.textContent = message;
}

function formatRefreshTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function setupFilterControls() {
  if (filtersReady) return;
  filtersReady = true;

  const applyButton = document.getElementById("applyFiltersButton");
  const resetButton = document.getElementById("resetFiltersButton");
  const airportInput = document.getElementById("airportFilter");
  const airlineInput = document.getElementById("airlineFilter");

  if (applyButton) applyButton.addEventListener("click", applySelectedFilters);
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      airportInput.value = "SIN";
      airlineInput.value = "All Airlines";
      applySelectedFilters();
    });
  }

  [airportInput, airlineInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("change", applySelectedFilters);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") applySelectedFilters();
    });
  });
}

function populateFilterOptions(data) {
  const airports = uniqueSorted(data.map((row) => row.departure_airport));
  const selectedAirport = getFilterValue("airportFilter", "SIN");
  const airlineRows = selectedAirport && selectedAirport !== "All Airports"
    ? data.filter((row) => row.departure_airport === selectedAirport)
    : data;
  const airlines = uniqueSorted(airlineRows.map((row) => row.airline));

  setDatalistOptions("airportOptions", ["All Airports", ...airports]);
  setDatalistOptions("airlineOptions", ["All Airlines", ...airlines]);
}

function applySelectedFilters() {
  activeFilters = {
    airport: normalizeAirportFilter(getFilterValue("airportFilter", "SIN")),
    airline: normalizeFilterValue(getFilterValue("airlineFilter", "All Airlines"), "All Airlines")
  };

  populateFilterOptions(allData);
  currentData = applyFilters(allData);
  renderDashboard(currentData);
  updateFilterSummary();
}

function applyFilters(data) {
  return data.filter((row) => {
    const airportMatch = activeFilters.airport === "All Airports" || row.departure_airport === activeFilters.airport;
    const airlineMatch = activeFilters.airline === "All Airlines" || row.airline === activeFilters.airline;
    return airportMatch && airlineMatch;
  });
}

function updateFilterSummary() {
  const airport = activeFilters.airport === "All Airports" ? "all airports" : activeFilters.airport;
  const airline = activeFilters.airline === "All Airlines" ? "all airlines" : activeFilters.airline;
  setText("filterSummary", `Showing ${currentData.length.toLocaleString()} records for ${airport} and ${airline}.`);
}

function getFilterValue(id, fallback) {
  return document.getElementById(id)?.value?.trim() || fallback;
}

function normalizeFilterValue(value, allLabel) {
  if (!value) return allLabel;
  if (value.toLowerCase() === allLabel.toLowerCase()) return allLabel;
  return value;
}

function normalizeAirportFilter(value) {
  if (!value) return "All Airports";
  if (value.toLowerCase() === "all airports") return "All Airports";
  return value.toUpperCase();
}

function setDatalistOptions(id, options) {
  const datalist = document.getElementById(id);
  if (!datalist) return;
  datalist.innerHTML = options.map((option) => `<option value="${option}"></option>`).join("");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
