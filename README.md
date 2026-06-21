# Flight Fuel Optimization Dashboard

This project is a static GitHub Pages dashboard for an academic machine learning use case:

**Flight Fuel Optimization using Machine Learning**

The dashboard predicts taxi-out / pushback delay patterns and estimates extra fuel burn, cost impact, and CO2 emissions using synthetic aviation operations data.

## Dashboard Sections

- Overview
- Taxi-Out Time Analysis
- Weather & Congestion Impact
- Fuel Burn Estimation
- CO2 Impact
- ML Prediction Results
- Scenario Analysis

## Files

```text
flight-fuel-optimization-dashboard/
├── index.html
├── style.css
├── app.js
├── README.md
└── data/
    └── sample_flight_data.csv
```

## Dataset Features

The sample CSV includes:

- `flight_date`
- `travel_season`
- `departure_airport`
- `airline`
- `aircraft_type`
- `gate`
- `runway`
- `scheduled_departure_time`
- `actual_pushback_time`
- `taxi_out_time_minutes`
- `departure_delay_minutes`
- `wind_speed`
- `visibility`
- `wind_direction_degrees`
- `runway_heading_degrees`
- `headwind_component_knots`
- `tailwind_component_knots`
- `crosswind_component_knots`
- `weather_condition`
- `airport_congestion_level`
- `passenger_demand_index`
- `fuel_burn_rate_kg_per_minute`
- `estimated_extra_fuel_kg`
- `estimated_co2_kg`

## Charts

- Average taxi-out time trend
- Taxi delay by airport/runway
- Weather impact on taxi time
- Tailwind and crosswind impact on taxi-out time
- Singapore Changi peak vs off-peak taxi-out and fuel impact
- Congestion vs fuel burn
- Estimated fuel saving
- CO2 saving estimate
- Predicted vs actual taxi-out time

## Data Refresh

The dashboard includes a **Refresh Data** button. It re-fetches `data/sample_flight_data.csv` with a timestamped request so the browser does not reuse an older cached CSV. If the CSV content has changed, every metric, chart, scenario estimate, and sample table is rebuilt in place. If the file is unchanged, the dashboard reports that no newer CSV was found.

## Filtering

The dashboard defaults to Singapore Changi Airport (`SIN`) so the main view is focused on one airport. The repository dataset also includes Bengaluru Kempegowda Airport (`BLR`). Use the Airport and Airline filters to analyze a different airport or carrier; every chart, metric, scenario estimate, and table updates from the selected records.

## Methodology

The dashboard uses synthetic data designed to resemble airport surface operations. Taxi-out time rises with congestion, lower visibility, adverse weather, runway wind components, runway effects, and departure delay.

Raw wind speed is converted into runway-relative components:

```text
headwind_component = wind_speed * cos(wind_direction_degrees - runway_heading_degrees)
crosswind_component = abs(wind_speed * sin(wind_direction_degrees - runway_heading_degrees))
tailwind_component = max(-headwind_component, 0)
```

This feature engineering is more aviation-relevant than raw wind speed because the same wind can be a headwind, tailwind, or crosswind depending on assigned runway direction.

The dataset includes synthetic Singapore Changi Airport (`SIN`) and Bengaluru Kempegowda Airport (`BLR`) case studies. These rows are labeled as `Peak` or `Off-Peak` travel season and include a `passenger_demand_index` to model how seasonal demand can increase pushback delay, taxi queues, fuel burn, and emissions.

Extra fuel burn is estimated as:

```text
max(taxi_out_time_minutes - 14, 0) * fuel_burn_rate_kg_per_minute
```

CO2 emissions are estimated with:

```text
estimated_extra_fuel_kg * 3.16
```

The ML prediction chart uses a transparent JavaScript scoring function to emulate regression model output. For a full academic submission, this can be replaced with predictions exported from Python, R, or notebook-based training workflows.

## Run Locally

Because the dashboard fetches a CSV file, run it from a local static server:

```bash
cd flight-fuel-optimization-dashboard
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository.
2. In repository settings, open **Pages**.
3. Select the branch that contains the dashboard.
4. Set the Pages source to the repository root or this project folder, depending on repository layout.
5. Save and open the generated GitHub Pages URL.

No build step is required.
