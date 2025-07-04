let userData = JSON.parse(localStorage.getItem("user_data")) || {};

if (user) {
  const userKey = user.id;
  if (!userData[userKey]) {
    userData[userKey] = {
      watching: [],
      completed: [],
      favorites: [],
      episodesSeen: {}
    };
    localStorage.setItem("user_data", JSON.stringify(userData));
  }
}

// Para actualizar datos:
function updateUserData(newData) {
  userData[user.id] = {
    ...userData[user.id],
    ...newData
  };
  localStorage.setItem("user_data", JSON.stringify(userData));
}
