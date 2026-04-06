package ug.co.moat.app

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

class MoatStorageBridge(
    context: Context,
) {
    private val database = MoatStorageDatabase(context)

    @JavascriptInterface
    fun isStorageAvailable(): Boolean = database.isAvailable()

    @JavascriptInterface
    fun clearStorage(): Boolean = database.clearAll()

    @JavascriptInterface
    fun executeStorageCommand(commandJson: String): String {
        return try {
            val command = JSONObject(commandJson)
            val action = command.getString("action")
            val result = when (action) {
                "getById" -> database.getById(
                    command.getString("store"),
                    command.getString("id"),
                )

                "listAll" -> database.listAll(command.getString("store"))

                "listByUser" -> database.listByUser(
                    command.getString("store"),
                    command.getString("userId"),
                )

                "listByField" -> database.listByField(
                    command.getString("store"),
                    command.getString("field"),
                    command.get("value"),
                )

                "listByFieldPrefix" -> database.listByFieldPrefix(
                    command.getString("store"),
                    command.getString("field"),
                    command.getString("prefix"),
                    command.optString("userId").ifBlank { null },
                )

                "listByFields" -> database.listByFields(
                    command.getString("store"),
                    command.getJSONArray("filters"),
                )

                "listByFieldIn" -> database.listByFieldIn(
                    command.getString("store"),
                    command.getString("field"),
                    command.getJSONArray("values"),
                    command.optString("userId").ifBlank { null },
                )

                "upsert" -> database.upsert(
                    command.getString("store"),
                    command.getJSONObject("record"),
                )

                "remove" -> {
                    database.remove(command.getString("store"), command.getString("id"))
                    JSONObject.NULL
                }

                "replaceAll" -> database.replaceAll(
                    command.getString("store"),
                    command.optJSONArray("records") ?: JSONArray(),
                )

                "clearAll" -> {
                    database.clearAll()
                    JSONObject.NULL
                }

                else -> throw IllegalArgumentException("Unsupported native storage action: $action")
            }

            JSONObject()
                .put("ok", true)
                .put("result", result ?: JSONObject.NULL)
                .toString()
        } catch (error: Exception) {
            JSONObject()
                .put("ok", false)
                .put("error", error.message ?: "Unknown native storage error.")
                .toString()
        }
    }
}
