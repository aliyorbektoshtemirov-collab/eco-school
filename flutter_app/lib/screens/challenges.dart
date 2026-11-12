import 'dart:io';
import 'site_page.dart';

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
  List<dynamic> _announcements = const [];
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
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    // E'lonlar — chiqmasa ham vazifalar ro'yxatiga xalaqit bermasin.
    try {
      final res = await Api.instance.get('/announcements');
      if (mounted) {
        setState(() => _announcements = res['announcements'] as List? ?? const []);
      }
    } catch (_) {
      // jim o'tkazamiz
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

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 20),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF244B32), Color(0xFF4D8050)]), borderRadius: BorderRadius.circular(28)),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('HAR BIR QADAM MUHIM 🌱', style: TextStyle(color: Colors.white70)),
            SizedBox(height: 12),
            Text('Bugun tabiat uchun nima qilamiz?', style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text('Vazifani tanlang, bajaring va eco ball yig‘ing.', style: TextStyle(color: Colors.white70)),
          ]),
        ),
        ..._announcements.whereType<Map<String, dynamic>>().map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _AnnouncementCard(item: item),
              ),
            ),
        if (_challenges.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 20),
            child: EmptyNote(
              icon: Icons.task_alt_outlined,
              title: 'Hozircha vazifa yo‘q',
              hint: 'Yangi vazifa qo‘shilganda shu yerda paydo bo‘ladi.',
            ),
          )
        else
          ..._challenges.whereType<Map<String, dynamic>>().map((challenge) {
            final id = (challenge['id'] as num?)?.toInt() ?? 0;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ChallengeCard(
                challenge: challenge,
                submission: _submissions[id],
                onSubmit: () => _submit(challenge),
              ),
            );
          }),
      ],
    );
  }
}

/// Adminlar e'loni — saytdagi banner o'rnida.
class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final title = item['title'] as String? ?? '';
    final body = item['body'] as String? ?? '';
    final link = item['link'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Eco.amberTint,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E2BE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.campaign_outlined, size: 21, color: Eco.amber),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    color: Eco.ink,
                    height: 1.3,
                  ),
                ),
                if (body.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    body,
                    style: const TextStyle(fontSize: 14, height: 1.5, color: Eco.muted),
                  ),
                ],
                if (link.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SelectableText(
                    link,
                    style: const TextStyle(fontSize: 13, color: Eco.green),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  shortDate(item['created_at']),
                  style: const TextStyle(fontSize: 12, color: Eco.faint),
                ),
              ],
            ),
          ),
        ],
      ),
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
          if (submission != null)
            TextButton.icon(icon: const Icon(Icons.chat_outlined), label: const Text('Admin javoblari'), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SitePage(path: '/feedback/challenge/${submission!['id']}', title: 'Admin javoblari')))),
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
  /// Bitta topshiriqqa nechta rasm qo'shish mumkin.
  static const _maxPhotos = 5;

  final _note = TextEditingController();
  final List<File> _photos = [];

  bool _busy = false;
  String _progress = '';
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  /// Kameradan bitta, galereyadan bir nechta rasm olinadi.
  Future<void> _pick(ImageSource source) async {
    final free = _maxPhotos - _photos.length;
    if (free <= 0) return;

    try {
      final picker = ImagePicker();
      final List<XFile> picked;

      if (source == ImageSource.gallery) {
        picked = await picker.pickMultiImage(
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 82,
        );
      } else {
        final shot = await picker.pickImage(
          source: ImageSource.camera,
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 82,
        );
        picked = shot == null ? const [] : [shot];
      }

      if (picked.isEmpty || !mounted) return;

      setState(() {
        _error = picked.length > free
            ? 'Eng ko‘pi $_maxPhotos ta rasm qo‘shish mumkin.'
            : null;
        _photos.addAll(picked.take(free).map((x) => File(x.path)));
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Rasmni ochib bo‘lmadi.');
    }
  }

  Future<void> _send() async {
    final note = _note.text.trim();
    if (note.isEmpty && _photos.isEmpty) {
      setState(() => _error = 'Izoh yozing yoki rasm qo‘shing.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final keys = <String>[];

      for (var i = 0; i < _photos.length; i++) {
        if (mounted) {
          setState(() {
            _progress = _photos.length > 1
                ? 'Rasm yuklanmoqda: ${i + 1}/${_photos.length}'
                : 'Rasm yuklanmoqda...';
          });
        }
        keys.add(await Api.instance.uploadImage(_photos[i]));
      }

      if (mounted) setState(() => _progress = '');

      final id = (widget.challenge['id'] as num).toInt();
      final res = await Api.instance.post('/challenges/$id/submit', {
        'proofText': note,
        if (keys.isNotEmpty) 'proofUrls': keys,
      });

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'Yuborildi.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _progress = '';
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
                'Nima qilganingizni qisqacha yozing. 5 tagacha rasm qo‘shsangiz bo‘ladi.',
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

              if (_photos.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (var i = 0; i < _photos.length; i++)
                      _Thumb(
                        file: _photos[i],
                        onRemove: _busy ? null : () => setState(() => _photos.removeAt(i)),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
              ],

              if (_photos.length < _maxPhotos)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : () => _pick(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_outlined, size: 19),
                        label: const Text('Suratga olish'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                        icon: const Icon(Icons.image_outlined, size: 19),
                        label: Text(_photos.isEmpty ? 'Galereya' : 'Yana qo‘shish'),
                      ),
                    ),
                  ],
                )
              else
                const Text(
                  'Eng ko‘pi 5 ta rasm qo‘shildi.',
                  style: TextStyle(fontSize: 13, color: Eco.muted),
                ),

              if (_progress.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  _progress,
                  style: const TextStyle(fontSize: 13.5, color: Eco.green),
                ),
              ],

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

/// Tanlangan rasmning kichik ko'rinishi — burchagida olib tashlash tugmasi.
class _Thumb extends StatelessWidget {
  const _Thumb({required this.file, this.onRemove});

  final File file;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 86,
      height: 86,
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(file, fit: BoxFit.cover),
            ),
          ),
          Positioned(
            top: 2,
            right: 2,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Color(0xCC1C2A1B),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
