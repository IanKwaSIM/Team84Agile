document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Fetch weekly challenge
        const challengeResponse = await fetch("/challenges/current");
        const challengeContentType = challengeResponse.headers.get("content-type");

        if (!challengeContentType || !challengeContentType.includes("application/json")) {
            throw new Error("Received non-JSON response for challenge");
        }

        const challengeData = await challengeResponse.json();
        document.querySelector(".challenge-text").textContent = challengeData.challenge_text || "No challenge available this week!";

        // Fetch leaderboard
        const leaderboardResponse = await fetch("/leaderboard");
        const leaderboardContentType = leaderboardResponse.headers.get("content-type");

        if (!leaderboardContentType || !leaderboardContentType.includes("application/json")) {
            throw new Error("Received non-JSON response for leaderboard");
        }

        const leaderboardData = await leaderboardResponse.json();
        const leaderboardList = document.getElementById("leaderboard-list");
        leaderboardList.innerHTML = ""; // Clear previous content

        leaderboardData.forEach((entry, index) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${index + 1}. ${entry.username} - ${entry.points} pts`;
            leaderboardList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error fetching data:", error);
        document.querySelector(".challenge-text").textContent = "Failed to load challenge.";
        document.getElementById("leaderboard-list").innerHTML = "<li>Failed to load leaderboard.</li>";
    }
});
