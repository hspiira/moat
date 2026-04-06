package ug.co.moat.app

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

private const val DATABASE_NAME = "moat-storage.db"
private const val DATABASE_VERSION = 1

private val STORE_NAMES = listOf(
    "meta",
    "userProfiles",
    "accounts",
    "transactions",
    "captureEnvelopes",
    "captureReviewItems",
    "correctionLogs",
    "transactionRules",
    "recurringObligations",
    "monthCloses",
    "categories",
    "goals",
    "budgets",
    "investmentProfiles",
    "imports",
    "resources",
    "syncProfiles",
    "syncOutbox",
)

class MoatStorageDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        STORE_NAMES.forEach { store ->
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS $store (
                    id TEXT PRIMARY KEY NOT NULL,
                    userId TEXT,
                    occurredOn TEXT,
                    month TEXT,
                    period TEXT,
                    status TEXT,
                    isDefault INTEGER,
                    payload TEXT NOT NULL
                )
                """.trimIndent(),
            )
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_userId ON $store(userId)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_occurredOn ON $store(occurredOn)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_month ON $store(month)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_period ON $store(period)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_status ON $store(status)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_${store}_isDefault ON $store(isDefault)")
        }
        db.execSQL("PRAGMA user_version = $DATABASE_VERSION")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 1) {
            onCreate(db)
            return
        }
        db.execSQL("PRAGMA user_version = $newVersion")
    }

    fun isAvailable(): Boolean = true

    fun clearAll(): Boolean {
        writableDatabase.use { db ->
            db.beginTransaction()
            try {
                STORE_NAMES.forEach { store ->
                    db.delete(store, null, null)
                }
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        return true
    }

    fun getById(store: String, id: String): Any? =
        readableDatabase.use { db ->
            db.query(store, arrayOf("payload"), "id = ?", arrayOf(id), null, null, null).use { cursor ->
                if (!cursor.moveToFirst()) {
                    return@use null
                }
                return@use JSONObject(cursor.getString(0))
            }
        }

    fun listAll(store: String): JSONArray =
        readableDatabase.use { db ->
            db.query(store, arrayOf("payload"), null, null, null, null, null).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun listByUser(store: String, userId: String): JSONArray =
        readableDatabase.use { db ->
            db.query(store, arrayOf("payload"), "userId = ?", arrayOf(userId), null, null, null).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun listByField(store: String, field: String, value: Any): JSONArray =
        readableDatabase.use { db ->
            val column = validateColumn(field)
            db.query(
                store,
                arrayOf("payload"),
                "$column = ?",
                arrayOf(toSqlValue(value)),
                null,
                null,
                null,
            ).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun listByFieldPrefix(store: String, field: String, prefix: String, userId: String?): JSONArray =
        readableDatabase.use { db ->
            val column = validateColumn(field)
            val clauses = mutableListOf<String>()
            val args = mutableListOf<String>()
            if (!userId.isNullOrBlank()) {
                clauses += "userId = ?"
                args += userId
            }
            clauses += "$column LIKE ?"
            args += "$prefix%"
            db.query(
                store,
                arrayOf("payload"),
                clauses.joinToString(" AND "),
                args.toTypedArray(),
                null,
                null,
                null,
            ).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun listByFields(store: String, filters: JSONArray): JSONArray =
        readableDatabase.use { db ->
            val clauses = mutableListOf<String>()
            val args = mutableListOf<String>()
            for (index in 0 until filters.length()) {
                val filter = filters.getJSONObject(index)
                val column = validateColumn(filter.getString("field"))
                clauses += "$column = ?"
                args += toSqlValue(filter.get("value"))
            }
            db.query(
                store,
                arrayOf("payload"),
                clauses.joinToString(" AND "),
                args.toTypedArray(),
                null,
                null,
                null,
            ).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun listByFieldIn(store: String, field: String, values: JSONArray, userId: String?): JSONArray =
        readableDatabase.use { db ->
            val column = validateColumn(field)
            val placeholders = List(values.length()) { "?" }.joinToString(", ")
            val clauses = mutableListOf<String>()
            val args = mutableListOf<String>()
            if (!userId.isNullOrBlank()) {
                clauses += "userId = ?"
                args += userId
            }
            clauses += "$column IN ($placeholders)"
            for (index in 0 until values.length()) {
                args += toSqlValue(values.get(index))
            }
            db.query(
                store,
                arrayOf("payload"),
                clauses.joinToString(" AND "),
                args.toTypedArray(),
                null,
                null,
                null,
            ).use { cursor ->
                return@use payloadArray(cursor)
            }
        }

    fun upsert(store: String, record: JSONObject): JSONObject {
        writableDatabase.use { db ->
            db.insertWithOnConflict(
                store,
                null,
                contentValuesForRecord(record),
                SQLiteDatabase.CONFLICT_REPLACE,
            )
        }
        return record
    }

    fun remove(store: String, id: String) {
        writableDatabase.use { db ->
            db.delete(store, "id = ?", arrayOf(id))
        }
    }

    fun replaceAll(store: String, records: JSONArray): JSONArray {
        writableDatabase.use { db ->
            db.beginTransaction()
            try {
                db.delete(store, null, null)
                for (index in 0 until records.length()) {
                    val record = records.getJSONObject(index)
                    db.insertWithOnConflict(
                        store,
                        null,
                        contentValuesForRecord(record),
                        SQLiteDatabase.CONFLICT_REPLACE,
                    )
                }
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        return records
    }

    private fun payloadArray(cursor: Cursor): JSONArray {
        val results = JSONArray()
        while (cursor.moveToNext()) {
            results.put(JSONObject(cursor.getString(0)))
        }
        return results
    }

    private fun contentValuesForRecord(record: JSONObject): ContentValues {
        if (!record.has("id")) {
            throw IllegalArgumentException("Native storage records must include an id.")
        }

        return ContentValues().apply {
            put("id", record.getString("id"))
            putNullableString("userId", record.optStringOrNull("userId"))
            putNullableString("occurredOn", record.optStringOrNull("occurredOn"))
            putNullableString("month", record.optStringOrNull("month"))
            putNullableString("period", record.optStringOrNull("period"))
            putNullableString("status", record.optStringOrNull("status"))
            if (record.has("isDefault") && !record.isNull("isDefault")) {
                put("isDefault", if (record.getBoolean("isDefault")) 1 else 0)
            } else {
                putNull("isDefault")
            }
            put("payload", record.toString())
        }
    }

    private fun validateColumn(column: String): String {
        val allowedColumns = setOf("id", "userId", "occurredOn", "month", "period", "status", "isDefault")
        if (!allowedColumns.contains(column)) {
            throw IllegalArgumentException("Unsupported SQLite storage column: $column")
        }
        return column
    }

    private fun toSqlValue(value: Any): String = when (value) {
        is Boolean -> if (value) "1" else "0"
        JSONObject.NULL -> ""
        else -> value.toString()
    }

    private fun ContentValues.putNullableString(key: String, value: String?) {
        if (value == null) {
            putNull(key)
        } else {
            put(key, value)
        }
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) {
            return null
        }
        return getString(key)
    }
}
