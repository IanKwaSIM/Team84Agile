let map;
let service;
let infowindow;

// Define multiple regions covering different parts of Singapore
const singaporeRegions = [
    { lat: 1.3521, lng: 103.8198 }, // Central Singapore
    { lat: 1.4173, lng: 103.8333 }, // North (Woodlands, Yishun)
    { lat: 1.345, lng: 103.930 }, // East (Tampines, Changi)
    { lat: 1.2905, lng: 103.7750 }, // West (Jurong, Clementi)
    { lat: 1.320, lng: 103.700 }, // South-West (Bukit Timah, Bukit Batok)
    { lat: 1.283, lng: 103.635 }, // NEW: Tuas Area (Western Singapore)
    { lat: 1.310, lng: 103.690 }, // NEW: Pioneer & Boon Lay
];

function initMap() {
    console.log(" Initializing Google Maps...");

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
    console.log(" Searching for gyms across multiple regions in Singapore...");

    singaporeRegions.forEach((region, index) => {
        setTimeout(() => {
            searchGyms(region);
        }, index * 2000); // Introduce delay to avoid hitting API rate limits
    });
}

function searchGyms(location) {
    console.log(` Searching for gyms in region: ${location.lat}, ${location.lng}`);

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
    gymList.innerHTML = ""; // Clear previous results

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        console.log(` Found ${results.length} gyms in this region`);

        results.forEach((place) => {
            createMarker(place);
            addGymToList(place);
        });

        if (pagination && pagination.hasNextPage) {
            setTimeout(() => pagination.nextPage(), 2000);
        }
    } else {
        console.error(" Places API Error:", status);
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

// Function to refresh gym search every 60 seconds
function autoRefreshGyms() {
    setInterval(() => {
        console.log(" Refreshing gym search...");
        searchAllRegions();
    }, 60000); // Refresh every 60 seconds
}

function searchLocation() {
    const query = document.getElementById("location-input").value.trim();

    if (!query) {
        alert(" Please enter a location or gym name.");
        return;
    }

    console.log(" Searching for:", query);

    const request = {
        query: query,
        fields: ["name", "geometry", "formatted_address"],
    };

    service = new google.maps.places.PlacesService(map);
    service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
            const location = results[0].geometry.location;
            map.setCenter(location);
            map.setZoom(14); // Zoom in to show the searched area

            results.forEach((place) => createMarker(place)); // Mark all found gyms
            console.log(" Found location:", results[0]);

        } else {
            alert(" Location or gym not found. Try again.");
        }
    });
}

function addGymToList(place) {
    let gymList = document.getElementById("gym-list");
    
    let listItem = document.createElement("li");
    listItem.innerHTML = `<strong>${place.name}</strong><br>${place.formatted_address || "No address available"}`;

    listItem.onclick = () => {
        map.setCenter(place.geometry.location);
        map.setZoom(15);
    };

    gymList.appendChild(listItem);
}

window.onload = () => {
    initMap();
    autoRefreshGyms();
};