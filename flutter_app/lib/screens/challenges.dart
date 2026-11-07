import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Challenge'lar: ro'yxat va topshirish.
class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});

  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  List<dynamic> _challenges = const [];
  Map<int, Map<String, dynamic>> _submissions = const {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/challenges');
      final subs = <int, Map<String, dynamic>>{};
      for (final item in (res['submissions'] as List? ?? const [])) {
        final map = item as Map<String, dynamic>;
        subs[(map['challenge_id'] as num).toInt()] = map;
      }

      setState(() {
        _challenges = res['challenges'] as List? ?? const [];
        _submissions = subs;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit(Map<String, dynamic> challenge) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SubmitSheet(challenge: challenge),
    );

    if (sent == true) {
      await _load();
      await session.refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(
        title: const Text('Vazifalar'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh, size: 22)),
        ],
      ),
      body: RefreshIndicator(
        color: Eco.green,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    if (_challenges.isEmpty) {
      return const EmptyNote(
        icon: Icons.task_alt_outlined,
        title: 'Hozircha vazifa yo‘q',
        hint: 'Yangi vazifa qo‘shilganda shu yerda paydo bo‘ladi.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: _challenges.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final challenge = _challenges[index] as Map<String, dynamic>;
        final id = (challenge['id'] as num).toInt();
        final submission = _submissions[id];

        return _ChallengeCard(
          challenge: challenge,
          submission: submission,
          onSubmit: () => _submit(challenge),
        );
      },
    );
  }
}

class _ChallengeCard extends StatelessWidget {
  const _ChallengeCard({
    required this.challenge,
    required this.submission,
    required this.onSubmit,
  });

  final Map<String, dynamic> challenge;
  final Map<String, dynamic>? submission;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final points = (challenge['points'] as num?)?.toInt() ?? 0;
    final category = challenge['category'] as String? ?? '';
    final endDate = challenge['end_date'] as String?;
    final status = submission?['status'] as String?;

    return EcoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  challenge['title'] as String? ?? '',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Eco.ink,
                    height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '+$points',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Eco.green,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (category.isNotEmpty)
                Text(
                  category,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                    color: Eco.faint,
                  ),
                ),
              if (endDate != null) ...[
                const SizedBox(width: 10),
                Text(
                  '$endDate gacha',
                  style: const TextStyle(fontSize: 11.5, color: Eco.faint),
                ),
              ],
            ],
          ),
          if ((challenge['description'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              challenge['description'] as String,
              style: const TextStyle(fontSize: 14, height: 1.55, color: Eco.muted),
            ),
          ],
          const SizedBox(height: 16),
          if (status == null)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(onPressed: onSubmit, child: const Text('Men bajardim')),
            )
          else
            Row(
              children: [
                StatusChip(status: status),
                const Spacer(),
                if (status == 'approved')
                  Text(
                    '+${(submission?['awarded_points'] as num?)?.toInt() ?? points} ball olindi',
                    style: const TextStyle(fontSize: 13, color: Eco.green),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Topshirish oynasi — izoh va rasm.
class _SubmitSheet extends StatefulWidget {
  const _SubmitSheet({required this.challenge});

  final Map<String, dynamic> challenge;

  @override
  State<_SubmitSheet> createState() => _SubmitSheetState();
}

class _SubmitSheetState extends State<_SubmitSheet> {
  final _note = TextEditingController();
  File? _photo;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
      );
      if (picked != null) setState(() => _photo = File(picked.path));
    } catch (_) {
      setState(() => _error = 'Rasmni ochib bo‘lmadi.');
    }
  }

  Future<void> _send() async {
    final note = _note.text.trim();
    if (note.isEmpty && _photo == null) {
      setState(() => _error = 'Izoh yozing yoki rasm qo‘shing.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      String? key;
      if (_photo != null) key = await Api.instance.uploadImage(_photo!);

      final id = (widget.challenge['id'] as num).toInt();
      final res = await Api.instance.post('/challenges/$id/submit', {
        'proofText': note,
        if (key != null) 'proofUrl': key,
      });

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'Yuborildi.');
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Eco.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Eco.rule,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                widget.challenge['title'] as String? ?? '',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Eco.ink,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Nima qilganingizni qisqacha yozing va rasm qo‘shing.',
                style: TextStyle(fontSize: 13.5, height: 1.5, color: Eco.muted),
              ),
              const SizedBox(height: 18),

              TextField(
                controller: _note,
                maxLines: 4,
                maxLength: 2000,
                decoration: const InputDecoration(
                  hintText: 'Masalan: uyda qog‘oz va plastikni alohida yig‘a boshladik...',
                ),
              ),

              if (_photo != null) ...[
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_photo!, height: 180, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => setState(() => _photo = null),
                  icon: const Icon(Icons.close, size: 18),
                  label: const Text('Rasmni olib tashlash'),
                ),
              ] else
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pick(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_outlined, size: 19),
                        label: const Text('Suratga olish'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pick(ImageSource.gallery),
                        icon: const Icon(Icons.image_outlined, size: 19),
                        label: const Text('Galereya'),
                      ),
                    ),
                  ],
                ),

              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 13.5, color: Eco.brick),
                ),
              ],

              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: _busy ? null : _send,
                child: Text(_busy ? 'Yuborilmoqda...' : 'Yuborish'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
