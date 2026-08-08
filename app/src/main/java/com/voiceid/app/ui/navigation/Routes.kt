package com.voiceid.app.ui.navigation

object Routes {
    const val WELCOME = "welcome"
    const val LOGIN = "login"
    const val SIGN_UP = "sign_up"
    const val FORGOT_PASSWORD = "forgot_password"
    const val CHOOSE_USERNAME = "choose_username"

    const val HOME = "home"
    const val SEARCH = "search"
    const val CONTACTS = "contacts"
    const val FRIEND_REQUESTS = "friend_requests"
    const val CHAT = "chat/{conversationId}/{otherUserId}/{otherUserName}"
    const val CALL_HISTORY = "call_history"
    const val NOTIFICATIONS = "notifications"
    const val PROFILE = "profile"
    const val EDIT_PROFILE = "edit_profile"
    const val SETTINGS = "settings"
    const val ACTIVE_CALL = "active_call"

    fun chat(conversationId: String, otherUserId: String, otherUserName: String) =
        "chat/$conversationId/$otherUserId/$otherUserName"
}
