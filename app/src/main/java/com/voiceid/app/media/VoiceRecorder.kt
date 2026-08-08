package com.voiceid.app.media

import android.content.Context
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

/**
 * Wraps android.media.MediaRecorder for voice messages. Max duration is capped at 120s to
 * match the DB's valid_voice_metadata CHECK constraint (API_REFERENCE.md §3.3 /
 * BACKEND_README.md §7.1) — recording auto-stops at the limit exactly like VoiceRecorder.tsx.
 */
class VoiceRecorderController(private val context: Context) {

    companion object {
        const val MAX_DURATION_SECONDS = 120
    }

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startTimeMs: Long = 0L

    private val _elapsedSeconds = MutableStateFlow(0)
    val elapsedSeconds: StateFlow<Int> = _elapsedSeconds.asStateFlow()

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    fun start(): File {
        val file = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        outputFile = file

        val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        mr.setAudioSource(MediaRecorder.AudioSource.MIC)
        mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        mr.setAudioEncodingBitRate(96_000)
        mr.setAudioSamplingRate(44_100)
        mr.setMaxDuration(MAX_DURATION_SECONDS * 1000)
        mr.setOutputFile(file.absolutePath)
        mr.setOnInfoListener { _, what, _ ->
            if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                stop()
            }
        }
        mr.prepare()
        mr.start()
        recorder = mr
        startTimeMs = System.currentTimeMillis()
        _isRecording.value = true
        _elapsedSeconds.value = 0
        return file
    }

    fun tick() {
        if (_isRecording.value) {
            _elapsedSeconds.value = ((System.currentTimeMillis() - startTimeMs) / 1000).toInt()
                .coerceAtMost(MAX_DURATION_SECONDS)
        }
    }

    /** Returns the recorded file + duration in whole seconds (min 1, per the DB constraint). */
    fun stop(): Pair<File, Int>? {
        if (!_isRecording.value) return null
        return try {
            recorder?.stop()
            recorder?.release()
            recorder = null
            _isRecording.value = false
            val duration = ((System.currentTimeMillis() - startTimeMs) / 1000).toInt().coerceIn(1, MAX_DURATION_SECONDS)
            outputFile?.let { it to duration }
        } catch (e: Exception) {
            recorder?.release()
            recorder = null
            _isRecording.value = false
            null
        }
    }

    fun cancel() {
        try {
            recorder?.stop()
        } catch (_: Exception) {
        }
        recorder?.release()
        recorder = null
        outputFile?.delete()
        _isRecording.value = false
        _elapsedSeconds.value = 0
    }
}

/** Simple MediaPlayer wrapper for voice message playback. */
class VoiceMessagePlayer {
    private var player: MediaPlayer? = null

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _progress = MutableStateFlow(0f)
    val progress: StateFlow<Float> = _progress.asStateFlow()

    fun play(file: File, onComplete: () -> Unit) {
        stop()
        val mp = MediaPlayer()
        mp.setDataSource(file.absolutePath)
        mp.setOnCompletionListener {
            _isPlaying.value = false
            _progress.value = 0f
            onComplete()
        }
        mp.prepare()
        mp.start()
        player = mp
        _isPlaying.value = true
    }

    fun updateProgress() {
        player?.let { mp ->
            if (mp.isPlaying && mp.duration > 0) {
                _progress.value = mp.currentPosition.toFloat() / mp.duration.toFloat()
            }
        }
    }

    fun stop() {
        player?.release()
        player = null
        _isPlaying.value = false
        _progress.value = 0f
    }
}
