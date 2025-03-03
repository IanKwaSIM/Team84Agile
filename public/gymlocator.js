let map;
let service;
let infowindow;
let refreshCount = 0;  // ✅ Declare refreshCount globally
const maxRefreshes = 0; // Stop refreshing after one full cycle
let markers = []; // ✅ Ensure this is at the top of the file

// Define multiple regions covering different parts of Singapore
const singaporeRegions = [
    { lat: 1.3521, lng: 103.8198 }, // Central Singapore
    { lat: 1.4173, lng: 103.8333 }, // North (Woodlands, Yishun)
    { lat: 1.345, lng: 103.930 }, // East (Tampines, Changi)
    { lat: 1.2905, lng: 103.7750 }, // West (Jurong, Clementi)
    { lat: 1.320, lng: 103.700 }, // South-West (Bukit Timah, Bukit Batok)
    { lat: 1.283, lng: 103.635 }, // 📍 NEW: Tuas Area (Western Singapore)
    { lat: 1.310, lng: 103.690 }, // 📍 NEW: Pioneer & Boon Lay
];

function initMap() {
    console.log("🗺️ Initializing Google Maps...");

    const singaporeLocation = { lat: 1.3521, lng: 103.8198 }; // Central Singapore

    map = new google.maps.Map(document.getElementById("map"), {
        center: singaporeLocation,
        zoom: 12, // Covers the entire Singapore region
        streetViewControl: false
    });

    searchAllRegions();
}

// Function to search gyms in all predefined Singapore regions
function searchAllRegions() {
    console.log("🔍 Searching for gyms across multiple regions in Singapore...");

    singaporeRegions.forEach((region, index) => {
        setTimeout(() => {
            searchGyms(region);
        }, index * 2000); // Introduce delay to avoid hitting API rate limits
    });
}

function searchGyms(location) {
    console.log(`🔍 Searching for gyms in region: ${location.lat}, ${location.lng}`);

    const request = {
        query: "gym",
        location: location,
        radius: 10000, // 10 km range per search to get better coverage
        fields: ["name", "geometry", "formatted_address"],
    };

    service = new google.maps.places.PlacesService(map);
    service.textSearch(request, handleResults);
}

function handleResults(results, status, pagination) {
    let gymList = document.getElementById("gym-list");
    clearGymList(); // Ensure gym list is cleared before updating

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        console.log(`✅ Found ${results.length} gyms in this area`);

        results.forEach((place) => {
            createMarker(place); // 🔹 Add markers dynamically
            addGymToList(place); // 🔹 Update the gym list
        });

        if (pagination && pagination.hasNextPage) {
            setTimeout(() => pagination.nextPage(), 2000);
        }
    } else {
        console.error("❌ No gyms found in this area.");
        gymList.innerHTML = "<li>No gyms found in this area.</li>";
    }
}

function createMarker(place) {
    const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name
    });

    const infowindow = new google.maps.InfoWindow({
        content: `<strong>${place.name}</strong><br>${place.formatted_address || "No address available"}`
    });

    marker.addListener("click", () => {
        infowindow.open(map, marker);

        setTimeout(() => {
            infowindow.close();
        }, 5000);
    });
}

function autoRefreshGyms() {
    setTimeout(() => {
        if (refreshCount >= maxRefreshes) {
            console.log("✅ Gym search refreshed once. Stopping further refresh.");
            return;
        }

        console.log(`🔄 Refreshing gyms... (Cycle ${refreshCount + 1}/${maxRefreshes})`);
        searchAllRegions();
        refreshCount++; // Track number of refreshes

    }, 60000); // Runs once after 60 seconds
}

function searchLocation() {
    const query = document.getElementById("location-input").value.trim();

    if (!query) {
        alert("❌ Please enter a location or postal code.");
        return;
    }

    console.log("🔍 Searching for:", query);

    const request = {
        query: query,
        fields: ["name", "geometry", "formatted_address"],
    };

    service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
            const location = results[0].geometry.location;
            map.setCenter(location);
            map.setZoom(14); // 🔍 Zoom into the searched location
            console.log("✅ Found location:", results[0].formatted_address);

            // ✅ Clear ONLY the gym list (DO NOT clear markers)
            clearGymList();

            updateNearbyGyms(location);
        } else {
            alert("❌ Location not found. Try again.");
        }
    });
}

function updateNearbyGyms(location) {
    console.log("📍 Updating Nearby Gyms List...");

    // ✅ Ensure `service` is initialized
    if (!service) {
        service = new google.maps.places.PlacesService(map);
    }

    const request = {
        location: location,
        radius: 5000, // Search within 5km
        type: "gym",  // Ensures only gym locations are returned
        fields: ["name", "geometry", "vicinity", "place_id"], // ✅ Request `place_id` for further details
    };

    service.nearbySearch(request, (results, status) => {
        let gymList = document.getElementById("gym-list");
        clearGymList(); // ✅ Clear previous gym list

        if (status === google.maps.places.PlacesServiceStatus.OK) {
            console.log(`✅ Found ${results.length} gyms nearby.`);

            // ✅ Sort gyms by distance from searched location
            results.sort((a, b) => {
                const distA = google.maps.geometry.spherical.computeDistanceBetween(
                    location,
                    a.geometry.location
                );
                const distB = google.maps.geometry.spherical.computeDistanceBetween(
                    location,
                    b.geometry.location
                );
                return distA - distB;
            });

            results.forEach((place) => {
                fetchGymDetails(place); // ✅ Fetch full details before adding to the list
                createMarker(place); // ✅ Add gym marker to the map
            });
        } else {
            console.error("❌ No nearby gyms found.");
            gymList.innerHTML = "<li>No nearby gyms found.</li>";
        }
    });
}

function fetchGymDetails(place) {
    const request = {
        placeId: place.place_id,
        fields: ["name", "formatted_address", "vicinity", "geometry"],
    };

    service.getDetails(request, (details, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            place.formatted_address = details.formatted_address || place.vicinity;
        } else {
            place.formatted_address = place.vicinity || "No address available";
        }
        addGymToList(place); // ✅ Add gym to the list with the correct address
    });
}

function addGymToList(place) {
    let gymList = document.getElementById("gym-list");
    
    let listItem = document.createElement("li");
    listItem.innerHTML = `<strong>${place.name}</strong><br>
                          ${place.formatted_address || "No address available"}`;

    // ✅ Clicking a gym moves the map and opens its info window
    listItem.onclick = () => {
        map.setCenter(place.geometry.location);
        map.setZoom(16);

        // ✅ Open the info window for this gym
        const infowindow = new google.maps.InfoWindow({
            content: `<strong>${place.name}</strong><br>${place.formatted_address || "No address available"}`
        });

        infowindow.open(map);
    };

    gymList.appendChild(listItem);
}

function clearGymList() {
    let gymList = document.getElementById("gym-list");
    if (gymList) {
        gymList.innerHTML = ""; // Clears the gym list
    }
}

window.onload = () => {
    initMap();
    autoRefreshGyms();
};
