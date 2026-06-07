// FuelFlow Core Application Controller

document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentSystem = 'us'; // 'us', 'uk', or 'metric'
  let history = JSON.parse(localStorage.getItem('fuelflow_history')) || [];
  let vehicles = JSON.parse(localStorage.getItem('fuelflow_vehicles')) || ['Primary Vehicle'];
  let activeVehicle = localStorage.getItem('fuelflow_active_vehicle') || 'all';
  let currentCalculation = null;

  // DOM Elements
  const unitBtns = document.querySelectorAll('.unit-btn');
  const calcForm = document.getElementById('calculator-form');
  const distanceInput = document.getElementById('distance');
  const fuelInput = document.getElementById('fuel');
  const priceInput = document.getElementById('price');
  
  // Dynamic Labels
  const distLabels = document.querySelectorAll('.unit-dist-label');
  const fuelLabels = document.querySelectorAll('.unit-fuel-label');
  const priceLabels = document.querySelectorAll('.unit-price-label');
  const economyUnitLabel = document.querySelector('.economy-unit-label');

  // Results & Stats
  const resEconomy = document.getElementById('res-economy');
  const resEconomyUnit = document.getElementById('res-economy-unit');
  const resCost = document.getElementById('res-cost');
  const resCostPerDist = document.getElementById('res-cost-per-dist');
  const btnLogTrip = document.getElementById('btn-log-trip');

  const statAvgEconomy = document.getElementById('stat-avg-economy');
  const statTotalDistance = document.getElementById('stat-total-distance');
  const statTotalCost = document.getElementById('stat-total-cost');

  const historyTbody = document.getElementById('history-tbody');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnClear = document.getElementById('btn-clear');

  // Vehicle Management DOM Elements
  const vehicleSelect = document.getElementById('vehicle-select');
  const btnAddVehicle = document.getElementById('btn-add-vehicle');
  const btnDeleteVehicle = document.getElementById('btn-delete-vehicle');

  // Unit definitions & system metadata
  const systems = {
    us: {
      dist: 'mi',
      fuel: 'gal',
      currency: '$',
      economyUnit: 'MPG'
    },
    uk: {
      dist: 'mi',
      fuel: 'imp gal',
      currency: '£',
      economyUnit: 'MPG (UK)'
    },
    metric: {
      dist: 'km',
      fuel: 'L',
      currency: '€',
      economyUnit: 'L/100km' // We will also calculate km/L in details
    }
  };

  // Convert values from source system to target system
  function convertValue(val, type, fromSys, toSys) {
    if (fromSys === toSys) return val;
    
    // First convert to base (Metric: km, liters)
    let baseDist = val;
    let baseFuel = val;
    
    if (type === 'dist') {
      if (fromSys === 'us' || fromSys === 'uk') {
        baseDist = val * 1.609344; // miles to km
      }
      // Now convert base (km) to target
      if (toSys === 'us' || toSys === 'uk') {
        return baseDist / 1.609344;
      }
      return baseDist;
    }

    if (type === 'fuel') {
      if (fromSys === 'us') baseFuel = val * 3.785411784; // US gal to L
      if (fromSys === 'uk') baseFuel = val * 4.54609; // UK gal to L
      
      // Now convert base (L) to target
      if (toSys === 'us') return baseFuel / 3.785411784;
      if (toSys === 'uk') return baseFuel / 4.54609;
      return baseFuel;
    }

    if (type === 'price') {
      // Price is per unit fuel. So convert to price per Liter first.
      let basePricePerL = val;
      if (fromSys === 'us') basePricePerL = val / 3.785411784;
      if (fromSys === 'uk') basePricePerL = val / 4.54609;

      // Convert price per L to target
      if (toSys === 'us') return basePricePerL * 3.785411784;
      if (toSys === 'uk') return basePricePerL * 4.54609;
      return basePricePerL;
    }

    return val;
  }

  // Update UI Labels when system changes
  function updateSystemLabels() {
    const sys = systems[currentSystem];
    
    distLabels.forEach(el => el.textContent = sys.dist);
    fuelLabels.forEach(el => el.textContent = sys.fuel);
    priceLabels.forEach(el => el.textContent = sys.fuel);
    if (economyUnitLabel) economyUnitLabel.textContent = sys.economyUnit;
    
    // Update input placeholders
    if (currentSystem === 'metric') {
      distanceInput.placeholder = 'e.g. 500';
      fuelInput.placeholder = 'e.g. 40';
      priceInput.placeholder = 'e.g. 1.85';
    } else {
      distanceInput.placeholder = 'e.g. 350';
      fuelInput.placeholder = 'e.g. 12';
      priceInput.placeholder = 'e.g. 3.45';
    }
  }

  // Calculate Fuel Economy
  function calculate() {
    const distance = parseFloat(distanceInput.value);
    const fuel = parseFloat(fuelInput.value);
    const price = parseFloat(priceInput.value) || 0;

    let isValid = true;

    // Validate inputs
    if (isNaN(distance) || distance <= 0) {
      distanceInput.classList.add('invalid');
      isValid = false;
    } else {
      distanceInput.classList.remove('invalid');
    }

    if (isNaN(fuel) || fuel <= 0) {
      fuelInput.classList.add('invalid');
      isValid = false;
    } else {
      fuelInput.classList.remove('invalid');
    }

    if (isNaN(price) || price < 0) {
      priceInput.classList.add('invalid');
      isValid = false;
    } else {
      priceInput.classList.remove('invalid');
    }

    if (!isValid) return null;

    let economy = 0;
    let economyText = '';
    const sys = systems[currentSystem];

    if (currentSystem === 'metric') {
      // Liters per 100km
      economy = (fuel / distance) * 100;
      const kmPerL = distance / fuel;
      economyText = `${economy.toFixed(2)} L/100km (${kmPerL.toFixed(2)} km/L)`;
    } else {
      // MPG (US or UK)
      economy = distance / fuel;
      economyText = `${economy.toFixed(2)} ${sys.economyUnit}`;
    }

    const totalCost = fuel * price;
    const costPerDist = distance > 0 ? totalCost / distance : 0;

    currentCalculation = {
      distance,
      fuel,
      price: price || null,
      economy,
      economyText,
      totalCost,
      costPerDist,
      system: currentSystem,
      vehicle: activeVehicle === 'all' ? vehicles[0] : activeVehicle,
      timestamp: Date.now()
    };

    // Render results
    resEconomy.textContent = currentSystem === 'metric' 
      ? `${economy.toFixed(2)}` 
      : `${economy.toFixed(2)}`;
    
    if (currentSystem === 'metric') {
      const kmPerL = distance / fuel;
      resEconomyUnit.innerHTML = `L/100km <span style="font-size:0.85rem; color:var(--text-secondary); display:block;">(${kmPerL.toFixed(2)} km/L)</span>`;
    } else {
      resEconomyUnit.textContent = sys.economyUnit;
    }

    if (price > 0) {
      resCost.textContent = `${sys.currency}${totalCost.toFixed(2)}`;
      resCostPerDist.textContent = `${sys.currency}${costPerDist.toFixed(3)}`;
    } else {
      resCost.textContent = 'N/A';
      resCostPerDist.textContent = 'N/A';
    }

    btnLogTrip.removeAttribute('disabled');
    return currentCalculation;
  }

  // Update Stats (Averages over entire log history, filtered by vehicle)
  function updateStats() {
    const filteredHistory = activeVehicle === 'all' 
      ? history 
      : history.filter(item => item.vehicle === activeVehicle);

    if (filteredHistory.length === 0) {
      statAvgEconomy.textContent = '-';
      statTotalDistance.textContent = '-';
      statTotalCost.textContent = '-';
      return;
    }

    const sys = systems[currentSystem];
    let totalDistConverted = 0;
    let totalFuelConverted = 0;
    let totalCostConverted = 0;

    filteredHistory.forEach(item => {
      const dist = convertValue(item.distance, 'dist', item.system, currentSystem);
      const fuel = convertValue(item.fuel, 'fuel', item.system, currentSystem);
      const cost = item.price ? (fuel * convertValue(item.price, 'price', item.system, currentSystem)) : 0;

      totalDistConverted += dist;
      totalFuelConverted += fuel;
      totalCostConverted += cost;
    });

    let avgEconomy = 0;
    if (currentSystem === 'metric') {
      avgEconomy = totalDistConverted > 0 ? (totalFuelConverted / totalDistConverted) * 100 : 0;
      statAvgEconomy.textContent = avgEconomy > 0 ? `${avgEconomy.toFixed(2)}` : '-';
    } else {
      avgEconomy = totalFuelConverted > 0 ? totalDistConverted / totalFuelConverted : 0;
      statAvgEconomy.textContent = avgEconomy > 0 ? `${avgEconomy.toFixed(2)}` : '-';
    }

    statTotalDistance.textContent = totalDistConverted.toFixed(1);
    statTotalCost.textContent = totalCostConverted > 0 ? `${sys.currency}${totalCostConverted.toFixed(2)}` : 'N/A';
  }

  // Render Log Table
  function renderHistory() {
    historyTbody.innerHTML = '';
    
    const filteredHistory = activeVehicle === 'all' 
      ? history 
      : history.filter(item => item.vehicle === activeVehicle);

    if (filteredHistory.length === 0) {
      historyTbody.innerHTML = `
        <tr class="empty-state">
          <td colspan="7">No trips logged yet for this vehicle. Start calculating to fill history.</td>
        </tr>
      `;
      return;
    }

    // Show newest first
    const sortedHistory = [...filteredHistory].sort((a, b) => b.timestamp - a.timestamp);

    sortedHistory.forEach(item => {
      const date = new Date(item.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: '2-digit'
      });
      
      const sys = systems[item.system];
      
      const distStr = `${item.distance.toFixed(1)} ${sys.dist}`;
      const fuelStr = `${item.fuel.toFixed(1)} ${sys.fuel}`;
      
      let econStr = '';
      if (item.system === 'metric') {
        const kmLVal = item.distance / item.fuel;
        econStr = `${item.economy.toFixed(2)} L/100k (${kmLVal.toFixed(1)} km/L)`;
      } else {
        econStr = `${item.economy.toFixed(2)} ${sys.economyUnit}`;
      }

      const costStr = item.price ? `${sys.currency}${(item.fuel * item.price).toFixed(2)}` : 'N/A';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${date}</td>
        <td><span class="badge-vehicle">${item.vehicle || 'Primary Vehicle'}</span></td>
        <td>${distStr}</td>
        <td>${fuelStr}</td>
        <td style="font-weight: 500;">${econStr}</td>
        <td>${costStr}</td>
        <td>
          <button type="button" class="btn-delete-row" data-id="${item.timestamp}" aria-label="Delete Entry">
            ✕
          </button>
        </td>
      `;
      historyTbody.appendChild(tr);
    });

    // Attach delete listeners
    document.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'));
        deleteLogEntry(id);
      });
    });
  }

  // Delete Individual Entry
  function deleteLogEntry(id) {
    history = history.filter(item => item.timestamp !== id);
    localStorage.setItem('fuelflow_history', JSON.stringify(history));
    renderHistory();
    updateStats();
  }

  // Add Current Calculation to Log
  function logCurrentTrip() {
    if (!currentCalculation) return;
    
    history.push(currentCalculation);
    localStorage.setItem('fuelflow_history', JSON.stringify(history));
    
    renderHistory();
    updateStats();
    
    // Reset form and current calc
    calcForm.reset();
    currentCalculation = null;
    btnLogTrip.setAttribute('disabled', 'true');
    
    // Clear results view values
    resEconomy.textContent = '-';
    resEconomyUnit.textContent = systems[currentSystem].economyUnit;
    resCost.textContent = '-';
    resCostPerDist.textContent = '-';
  }

  // Render Vehicle Selector options
  function renderVehicleOptions() {
    vehicleSelect.innerHTML = '';
    
    // Fleet Option
    const fleetOpt = document.createElement('option');
    fleetOpt.value = 'all';
    fleetOpt.textContent = 'All Vehicles (Fleet View)';
    vehicleSelect.appendChild(fleetOpt);
    
    // Individual Vehicles
    vehicles.forEach(veh => {
      const opt = document.createElement('option');
      opt.value = veh;
      opt.textContent = veh;
      vehicleSelect.appendChild(opt);
    });

    // Select Active Vehicle
    vehicleSelect.value = activeVehicle;
    
    // Disable delete button if showing all or only one vehicle exists
    if (activeVehicle === 'all' || vehicles.length <= 1) {
      btnDeleteVehicle.setAttribute('disabled', 'true');
    } else {
      btnDeleteVehicle.removeAttribute('disabled');
    }
  }

  // Switch Unit System
  function setSystem(sysCode) {
    currentSystem = sysCode;
    
    // Update selector buttons styling
    unitBtns.forEach(btn => {
      if (btn.getAttribute('data-unit') === sysCode) {
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
      }
    });

    updateSystemLabels();
    
    // Recalculate if there is current active values
    if (distanceInput.value || fuelInput.value) {
      calculate();
    }
    
    // Re-render statistics using the new system conversions
    updateStats();
  }

  // Event Listeners
  unitBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sysCode = e.target.getAttribute('data-unit');
      setSystem(sysCode);
    });
  });

  // Vehicle selection change handler
  vehicleSelect.addEventListener('change', (e) => {
    activeVehicle = e.target.value;
    localStorage.setItem('fuelflow_active_vehicle', activeVehicle);
    renderVehicleOptions();
    renderHistory();
    updateStats();
    
    // If there is an active calculation, update its vehicle target
    if (currentCalculation) {
      currentCalculation.vehicle = activeVehicle === 'all' ? vehicles[0] : activeVehicle;
    }
  });

  // Add Vehicle handler
  btnAddVehicle.addEventListener('click', () => {
    const name = prompt('Enter a name for the new vehicle (e.g., 2024 Hatchback):');
    if (!name) return;
    
    const trimmed = name.trim();
    if (!trimmed) return;
    
    if (vehicles.includes(trimmed)) {
      alert('A vehicle with that name already exists!');
      return;
    }

    vehicles.push(trimmed);
    localStorage.setItem('fuelflow_vehicles', JSON.stringify(vehicles));
    
    // Automatically switch to the new vehicle
    activeVehicle = trimmed;
    localStorage.setItem('fuelflow_active_vehicle', activeVehicle);
    
    renderVehicleOptions();
    renderHistory();
    updateStats();
  });

  // Delete Vehicle handler
  btnDeleteVehicle.addEventListener('click', () => {
    if (activeVehicle === 'all') return;
    
    if (confirm(`Are you sure you want to delete "${activeVehicle}"? This will also permanently remove all of its logged trip history.`)) {
      // Filter out trips
      history = history.filter(item => item.vehicle !== activeVehicle);
      localStorage.setItem('fuelflow_history', JSON.stringify(history));

      // Remove vehicle
      vehicles = vehicles.filter(v => v !== activeVehicle);
      localStorage.setItem('fuelflow_vehicles', JSON.stringify(vehicles));

      // Default back to first vehicle
      activeVehicle = vehicles[0] || 'all';
      localStorage.setItem('fuelflow_active_vehicle', activeVehicle);

      renderVehicleOptions();
      renderHistory();
      updateStats();
    }
  });

  calcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    calculate();
  });

  btnClear.addEventListener('click', () => {
    calcForm.reset();
    distanceInput.classList.remove('invalid');
    fuelInput.classList.remove('invalid');
    priceInput.classList.remove('invalid');
    
    resEconomy.textContent = '-';
    resEconomyUnit.textContent = systems[currentSystem].economyUnit;
    resCost.textContent = '-';
    resCostPerDist.textContent = '-';
    
    btnLogTrip.setAttribute('disabled', 'true');
    currentCalculation = null;
  });

  btnLogTrip.addEventListener('click', logCurrentTrip);

  btnClearHistory.addEventListener('click', () => {
    const scopeMsg = activeVehicle === 'all' 
      ? 'all trip logs across all vehicles' 
      : `all trip logs for vehicle "${activeVehicle}"`;

    if (confirm(`Are you sure you want to clear ${scopeMsg}? This cannot be undone.`)) {
      if (activeVehicle === 'all') {
        history = [];
      } else {
        history = history.filter(item => item.vehicle !== activeVehicle);
      }
      localStorage.setItem('fuelflow_history', JSON.stringify(history));
      renderHistory();
      updateStats();
    }
  });

  // Initialize
  updateSystemLabels();
  renderVehicleOptions();
  renderHistory();
  updateStats();
});
