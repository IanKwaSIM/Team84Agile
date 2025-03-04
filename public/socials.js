document.addEventListener("DOMContentLoaded", function () {
    //  Attach functions globally
    window.sendFriendRequest = sendFriendRequest;
    window.respondFriendRequest = respondFriendRequest;
    window.sendChatMessage = sendChatMessage;
    window.loadChatMessages = loadChatMessages;
    window.createGroup = createGroup;
    window.joinGroup = joinGroup;
    window.searchGroups = searchGroups;
    window.deleteGroup = deleteGroup;
    window.switchGroupTab = switchGroupTab;
    window.openChat = openChat;
    window.closeChat = closeChat;
    window.searchUsers = searchUsers;

    //  Load initial data
    loadFriends().then(() => {
        findNearbyUsers();
        findSimilarGoals();
    });
    loadFriendRequests();
    loadChatMessages();

//  **Retrieve Friend List First**
let friendsList = new Set();

async function loadFriends() {
    return fetch("/socials/friends")
        .then(response => response.json())
        .then(friends => {
            console.log("Friends List:", friends);
            const friendList = document.getElementById("friendList");

            if (!Array.isArray(friends) || friends.length === 0) {
                friendList.innerHTML = "<p>No friends yet.</p>";
                return;
            }

            friendsList = new Set(friends.map(friend => friend.user_id)); //  Store friends in a Set

            friendList.innerHTML = friends.map(friend => `
                <div>
                    <p><strong>${friend.username}</strong></p>
                    <button onclick="openChat('${friend.username}', ${friend.user_id}, 'private')">Chat</button>
                </div>
            `).join("");
        })
        .catch(error => console.error("Error loading friends:", error));
}

document.getElementById("searchUserForm").addEventListener("submit", function (e) {
    e.preventDefault();
    searchUsers();
});

//  Search Users Function
function searchUsers() {
    const searchQuery = document.getElementById("searchUser").value.trim();
    
    if (!searchQuery) {
        document.getElementById("searchResults").innerHTML = "<p>Please enter a username.</p>";
        return;
    }

    fetch(`/socials/search-users?query=${encodeURIComponent(searchQuery)}`)
        .then(response => response.json())
        .then(users => {
            console.log("User Search Results:", users);

            const searchResults = document.getElementById("searchResults");

            if (!Array.isArray(users)) {
                searchResults.innerHTML = `<p>${users.message || "No users found."}</p>`;
                return;
            }

            if (users.length === 0) {
                searchResults.innerHTML = "<p>No users found.</p>";
                return;
            }

            searchResults.innerHTML = users.map(user => `
                <div>
                    <p><strong>${user.username}</strong> - ${user.city}, ${user.country}</p>
                    ${
                        user.friendship_status === "friend"
                        ? `<span class="friend-status">✔️ Already Friends</span>`
                        : `<button onclick="sendFriendRequest(${user.user_id})">Add Friend</button>`
                    }
                </div>
            `).join("");
        })
        .catch(error => {
            console.error("Error searching users:", error);
            document.getElementById("searchResults").innerHTML = "<p>Error fetching search results.</p>";
        });
}

//  **Find Nearby Users (Exclude Friends)**
function findNearbyUsers() {
    console.log("Fetching nearby users...");

    fetch("/socials/nearby-users")
        .then(response => response.json())
        .then(users => {
            console.log("Nearby Users Response:", users);
            const nearbyUsersList = document.getElementById("nearbyUsersList");

            if (!Array.isArray(users) || users.length === 0) {
                nearbyUsersList.innerHTML = "<p>No nearby users found.</p>";
                return;
            }

            nearbyUsersList.innerHTML = users.map(user => `
                <div>
                    <p>${user.username} - ${user.city}, ${user.country} <br> 
                    <small>${user.distance.toFixed(2)} km away</small></p>
                    <button onclick="sendFriendRequest(${user.user_id})">Add Friend</button>
                </div>
            `).join("");
        })
        .catch(error => console.error("Error fetching nearby users:", error));
}

//  **Find Users with Similar Goals (Exclude Friends)**
function findSimilarGoals() {
    fetch("/socials/similar-goals")
        .then(response => response.json())
        .then(users => {
            console.log("Similar Goals Users:", users);
            const similarGoalsList = document.getElementById("similarGoalsList");

            if (!Array.isArray(users) || users.length === 0) {
                similarGoalsList.innerHTML = "<p>No users with similar goals found.</p>";
                return;
            }

            similarGoalsList.innerHTML = users
                .filter(user => !friendsList.has(user.user_id)) //  Exclude friends
                .map(user => `
                    <div>
                        <p>${user.username} - ${user.goals}</p>
                        <button onclick="sendFriendRequest(${user.user_id})" data-userid="${user.user_id}">
                            Add Friend
                        </button>
                    </div>
                `).join("");
        })
        .catch(error => console.error("Error fetching similar goals:", error));
}

//  Accept or Reject Friend Request
function respondFriendRequest(friendId, action) {
    fetch("/socials/respond-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId, action }),
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadFriends();
        loadFriendRequests();
    })
    .catch(error => console.error("Error responding to friend request:", error));
}

//  **Send Friend Request**
function sendFriendRequest(friendId) {
    if (!friendId) {
        console.error("Error: friendId is undefined.");
        alert("Error sending friend request. Please try again.");
        return;
    }

    console.log(`Sending friend request to user_id: ${friendId}`);

    fetch("/socials/add-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId }),
    })
    .then(response => response.json())
    .then(data => {
        console.log("Server Response:", data);
        alert(data.message);
        loadFriendRequests();
    })
    .catch(error => {
        console.error("Error sending friend request:", error);
        alert("Failed to send friend request. Try again.");
    });
}

//  **Load Pending Friend Requests**
function loadFriendRequests() {
    fetch("/socials/friend-requests")
        .then(response => response.json())
        .then(requests => {
            console.log("Friend Requests:", requests);
            const friendRequests = document.getElementById("friendRequests");

            if (!Array.isArray(requests) || requests.length === 0) {
                friendRequests.innerHTML = "<p>No pending friend requests.</p>";
                return;
            }

            friendRequests.innerHTML = requests.map(request => `
                <div class="friend-request">
                    <p>${request.username} wants to be your friend</p>
                    <div class="friend-request-buttons">
                        <button class="accept-friend" onclick="respondFriendRequest(${request.user_id}, 'accept')">Accept</button>
                        <button class="reject-friend" onclick="respondFriendRequest(${request.user_id}, 'reject')">Reject</button>
                    </div>
                </div>
            `).join("");
        })
        .catch(error => console.error("Error loading friend requests:", error));
}

    function searchGroups() {
        const searchQuery = document.getElementById("searchGroup").value.trim();
    
        fetch(`/socials/search-groups?query=${encodeURIComponent(searchQuery)}`)
            .then(response => response.json())
            .then(groups => {
                console.log("Groups List:", groups); // Debugging log
                const groupList = document.getElementById("groupList");
    
                if (!Array.isArray(groups) || groups.length === 0) {
                    groupList.innerHTML = "<p>No groups found.</p>";
                    return;
                }
    
                groupList.innerHTML = groups.map(group => `
                    <div>
                        <p><strong>${group.group_name}</strong> (Led by ${group.leader_name})</p>
                        <button onclick="joinGroup(${group.group_id})">Join Group</button>
                    </div>
                `).join("");
            })
            .catch(error => console.error("Error searching groups:", error));
    }
    
    //  Load groups initially
    document.addEventListener("DOMContentLoaded", function () {
        searchGroups();
    });

    function joinGroup(groupId) {
        fetch("/socials/join-group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: groupId }),
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadMyGroups();
        })
        .catch(error => console.error("Error joining group:", error));
    }


    loadAvailableGroups();
    loadMyGroups();

    //  Load Available Groups (Public Groups)
    function loadAvailableGroups() {
        fetch("/socials/search-groups?query=")
            .then(response => response.json())
            .then(groups => {
                console.log("Available Groups:", groups);
                const groupList = document.getElementById("availableGroupList");

                if (!Array.isArray(groups) || groups.length === 0) {
                    groupList.innerHTML = "<p>No groups found.</p>";
                    return;
                }

                groupList.innerHTML = groups.map(group => `
                    <div>
                        <p><strong>${group.group_name}</strong> (Led by ${group.leader_name})</p>
                        <button onclick="joinGroup(${group.group_id})">Join Group</button>
                    </div>
                `).join("");
            })
            .catch(error => console.error("Error fetching groups:", error));
    }

    //  Load My Groups (Groups the User Has Joined)
    function loadMyGroups() {
        const userIdElement = document.getElementById("currentUserId");

        if (!userIdElement || !userIdElement.value) {
            console.error("User ID is missing. Ensure it is defined in the HTML.");
            return;
        }

        const currentUserId = userIdElement.value;

        fetch("/socials/my-groups")
            .then(response => response.json())
            .then(groups => {
                console.log("My Groups:", groups);
                const myGroupList = document.getElementById("myGroupList");

                if (!Array.isArray(groups) || groups.length === 0) {
                    myGroupList.innerHTML = "<p>You are not in any groups.</p>";
                    return;
                }

                myGroupList.innerHTML = groups.map(group => `
                    <div class="group-item">
                        <p><strong>${group.group_name}</strong> (Led by ${group.leader_name})</p>
                        
                        <!-- 🔹 Button Container (Side by Side Buttons) -->
                        <div class="chat-action-container">
                            ${group.created_by == currentUserId ? 
                            `<button class="delete-chat-btn" onclick="deleteGroup(${group.group_id})">Delete Group</button>` : ""}
                            <button class="open-chat-btn" onclick="openChat('${group.group_name}', ${group.group_id}, 'group')">Chat</button>
                        </div>
                    </div>
                `).join("");
            })
            .catch(error => console.error("Error fetching my groups:", error));
    }
    
    //  Ensure function runs after DOM loads
    document.addEventListener("DOMContentLoaded", function () {
        loadMyGroups();
    });

    //  Delete Group (Only if User is the Creator)
    function deleteGroup(groupId) {
        if (!confirm("Are you sure you want to delete this group?")) return;

        fetch("/socials/delete-group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: groupId }),
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadMyGroups();
        })
        .catch(error => console.error("Error deleting group:", error));
    }

    //  Switch Group Tabs
    function switchGroupTab(tab) {
        document.getElementById("availableGroupsSection").style.display = (tab === "available") ? "block" : "none";
        document.getElementById("myGroupsSection").style.display = (tab === "my") ? "block" : "none";
    }

    //  Create Group (Ensures creator is the leader)
    function createGroup() {
        const groupNameInput = document.getElementById("groupName");
        const groupName = groupNameInput.value.trim(); // Remove extra spaces

        if (!groupName) {
            alert("Group name cannot be empty.");
            return;
        }

        fetch("/socials/create-group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_name: groupName }),
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            groupNameInput.value = ""; // Clear input after successful creation
            loadMyGroups();
        })
        .catch(error => console.error("Error creating group:", error));
    }

    function openChat(name, chatId, type) {
        const chatContainer = document.getElementById("chatContainer");
        if (!chatContainer) {
            console.error("Error: chatContainer is null. Ensure the chat UI is loaded before calling openChat().");
            return;
        }
    
        if (!chatId) {
            console.error("Error: chatId is undefined in openChat().");
            return;
        }
    
        console.log(`Opening ${type} chat with ID: ${chatId}`);
    
        chatContainer.style.display = "block"; // Show chat
        document.getElementById("chatTitle").innerText = `Chat with ${name}`;
        document.getElementById("chatMessages").innerHTML = ""; // Clear old messages
        document.getElementById("sendChatMessage").dataset.chatId = chatId;
        document.getElementById("sendChatMessage").dataset.chatType = type;
    
        loadChatMessages(chatId, type);
    }
    
    //  Close Chat
    function closeChat() {
        const chatContainer = document.getElementById("chatContainer");
        chatContainer.style.display = "none"; // Hide chat
    }

    //  Load Group Chat Messages (Fixed)
    function loadGroupChatMessages(groupId) {
        fetch(`/socials/group-chat?group_id=${groupId}`)
            .then(response => response.json())
            .then(messages => {
                const chatMessages = document.getElementById("chatMessages");
                chatMessages.innerHTML = messages.map(msg => `
                    <p><strong>${msg.sender}:</strong> ${msg.message} <small>(${msg.timestamp})</small></p>
                `).join("");
            })
            .catch(error => console.error("Error fetching chat messages:", error));
    }

    //  Load Private Chat Messages (Fixed)
    function loadPrivateChatMessages(friendId) {
        fetch(`/socials/private-chat?friend_id=${friendId}`)
            .then(response => response.json())
            .then(messages => {
                const chatMessages = document.getElementById("chatMessages");
                chatMessages.innerHTML = messages.map(msg => `
                    <p><strong>${msg.sender}:</strong> ${msg.message} <small>(${msg.timestamp})</small></p>
                `).join("");
            })
            .catch(error => console.error("Error fetching private chat messages:", error));
    }

    //  Load Chat Messages (Align Based on Sender)
    function loadChatMessages(chatId, type) {
        if (!chatId) {
            console.error("Error: chatId is undefined.");
            return;
        }

        const chatType = type === "group" ? "group-chat" : "private-chat";
        const paramName = type === "group" ? "group_id" : "user_id";

        console.log(`Loading ${type} chat messages for ${paramName}: ${chatId}`);

        fetch(`/socials/${chatType}?${paramName}=${chatId}`)
            .then(response => response.json())
            .then(messages => {
                console.log(`Messages for ${type} chat (${paramName} ${chatId}):`, messages);

                const chatMessages = document.getElementById("chatMessages");
                const currentUserId = document.getElementById("currentUserId").value; // Get the current user's ID

                if (!Array.isArray(messages) || messages.length === 0 || (messages.length === 1 && messages[0].message === "")) {
                    chatMessages.innerHTML = "<p>No messages yet.</p>";
                    return;
                }

                chatMessages.innerHTML = messages.map(msg => `
                    <div class="chat-message ${msg.sender_id == currentUserId ? "sent" : "received"}">
                        <p><strong>${msg.sender}:</strong> ${msg.message} <small>(${msg.timestamp})</small></p>
                    </div>
                `).join("");
            })
            .catch(error => console.error(`Error loading ${type} chat:`, error));
    }

    //  Send Private Chat Message with Debugging
    function sendChatMessage() {
        const messageInput = document.getElementById("chatMessage");
        const chatId = document.getElementById("sendChatMessage").dataset.chatId;
        const chatType = document.getElementById("sendChatMessage").dataset.chatType;

        if (!chatId || !messageInput.value.trim()) {
            console.error("Error: Missing user_id or message in sendChatMessage().");
            alert("Message cannot be empty.");
            return;
        }

        const apiEndpoint = chatType === "group" ? "/socials/group-chat/send" : "/socials/private-chat/send";
        const payload = chatType === "group" 
            ? { group_id: chatId, message: messageInput.value } 
            : { user_id: chatId, message: messageInput.value };

        console.log("Sending Chat Request:", apiEndpoint, "Payload:", payload); //  Debugging log

        fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Chat Sent Response:", data);
            if (data.message.includes("Invalid")) {
                alert("Chat failed: " + data.message);
            } else {
                messageInput.value = "";
                loadChatMessages(chatId, chatType);
            }
        })
        .catch(error => console.error("Error sending chat message:", error));
    }

    document.getElementById("sendChatMessage").addEventListener("click", sendChatMessage);

});
