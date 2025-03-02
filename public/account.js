document.addEventListener("DOMContentLoaded", function () {
    const muscleGroups = document.querySelectorAll(".muscle-group h3");
    const pastWorkoutsSection = document.getElementById("past-workouts");
    const pastWorkoutsList = document.getElementById("past-workouts-list");

    //  **Expand/Collapse Muscle Groups**
    muscleGroups.forEach(group => {
        group.addEventListener("click", function () {
            const exerciseList = this.nextElementSibling;
            exerciseList.classList.toggle("hidden");
        });
    });

    //  **Fetch and Display Past Workout Records**
    function fetchPastWorkouts() {
        fetch("/account/past-workouts")
            .then(response => response.json())
            .then(data => {
                console.log("Fetched Past Workouts:", data); // Debugging

                if (data.length === 0) {
                    pastWorkoutsList.innerHTML = "<p>No past workouts recorded.</p>";
                    return;
                }

                pastWorkoutsList.innerHTML = data.map(workout => `
                    <div class="workout-item">
                        <h4>${workout.date}</h4>
                        <p><strong>Exercise:</strong> ${workout.name} (${workout.muscle_group})</p>
                        <p><strong>PR:</strong> ${workout.max_weight} kg x ${workout.max_reps} reps</p>
                    </div>
                `).join("");
            })
            .catch(error => console.error("Error fetching past workouts:", error));
    }

    //  **Initialize Data Fetching**
    fetchPastWorkouts();
});
