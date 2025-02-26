document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/challenges/current");

        // Check if the response is actually JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Received non-JSON response");
        }

        const data = await response.json();
        
        document.querySelector(".challenge-text").textContent = data.challenge_text || "No challenge available this week!";
    } catch (error) {
        console.error("Error fetching challenge:", error);
        document.querySelector(".challenge-text").textContent = "Failed to load challenge.";
    }
});
