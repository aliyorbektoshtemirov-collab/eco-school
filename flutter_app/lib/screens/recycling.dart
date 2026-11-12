import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

const materialNames = {'paper': 'Qog‘oz', 'plastic': 'Plastik'};

/// Recycling: topshirish va o'z topshiriqlari tarixi.
class RecyclingScreen extends StatefulWidget {
  const RecyclingScreen({super.key});

  @override
  State<RecyclingScreen> createState() => _RecyclingScreenState();
}

class _RecyclingScreenState extends State<RecyclingScreen> {
  List<dynamic> _items = const [];
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
      final res = await Api.instance.get('/recycling');
      if (!mounted) return;
      setState(() {
        _items = res['submissions'] as List? ?? const [];
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _add() async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _RecyclingSheet(),
    );

    if (sent == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(
        title: const Text('Recycling'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh, size: 22)),
        ],
      ),
      body: RefreshIndicator(color: Eco.green, onRefresh: _load, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Loading();
    if (_error != null) return ErrorNote(message: _error!, onRetry: _load);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        EcoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chiqindi topshirish',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Eco.ink),
              ),
              const SizedBox(height: 7),
              const Text(
                'Qog‘oz yoki plastikni tarozida o‘lchab, rasmini yuklang. '
                'Eco Team tasdiqlagach ball qo‘shiladi.',
                style: TextStyle(fontSize: 13.5, height: 1.55, color: Eco.muted),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _add,
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Yangi topshiruv'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const Text(
          'Mening topshiriqlarim',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Eco.ink),
        ),
        const SizedBox(height: 12),
        if (_items.isEmpty)
          const EmptyNote(
            title: 'Hali topshiruv yo‘q',
            hint: 'Birinchi topshiruvdan keyin shu yerda ko‘rinadi.',
          )
        else
          ..._items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SubmissionTile(item: item as Map<String, dynamic>),
              )),
      ],
    );
  }
}

class _SubmissionTile extends StatelessWidget {
  const _SubmissionTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final material = item['material'] as String? ?? '';
    final amount = item['amount_kg'];
    final verified = item['verified_amount_kg'];
    final status = item['status'] as String? ?? 'pending';
    final points = (item['awarded_points'] as num?)?.toInt() ?? 0;

    return EcoCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Eco.greenTint,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(
              material == 'paper' ? Icons.description_outlined : Icons.local_drink_outlined,
              color: Eco.green,
              size: 21,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${materialNames[material] ?? material} · $amount kg',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Eco.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  status == 'approved' && verified != null
                      ? 'Tasdiqlangan: $verified kg · +$points ball'
                      : shortDate(item['submitted_at']),
                  style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          StatusChip(status: status),
        ],
      ),
    );
  }
}

class _RecyclingSheet extends StatefulWidget {
  const _RecyclingSheet();

  @override
  State<_RecyclingSheet> createState() => _RecyclingSheetState();
}

class _RecyclingSheetState extends State<_RecyclingSheet> {
  String _material = 'paper';
  final _amount = TextEditingController();
  File? _photo;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
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
    final amount = double.tryParse(_amount.text.replaceAll(',', '.'));

    if (amount == null || amount <= 0) {
      setState(() => _error = 'Vaznni kiriting, masalan 2.5');
      return;
    }
    if (_photo == null) {
      setState(() => _error = 'Tarozi rasmini yuklang.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final key = await Api.instance.uploadImage(_photo!);
      final res = await Api.instance.post('/recycling', {
        'material': _material,
        'amountKg': amount,
        'proofImage': key,
      });

      if (mounted) {
        Navigator.pop(context, true);
        showNote(context, res['message'] as String? ?? 'Yuborildi.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
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
              const Text(
                'Yangi topshiruv',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Eco.ink),
              ),
              const SizedBox(height: 18),

              Row(
                children: [
                  Expanded(child: _materialButton('paper', Icons.description_outlined)),
                  const SizedBox(width: 10),
                  Expanded(child: _materialButton('plastic', Icons.local_drink_outlined)),
                ],
              ),
              const SizedBox(height: 16),

              TextField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Vazn',
                  suffixText: 'kg',
                  hintText: '2.5',
                ),
              ),
              const SizedBox(height: 14),

              if (_photo != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_photo!, height: 170, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => setState(() => _photo = null),
                  icon: const Icon(Icons.close, size: 18),
                  label: const Text('Rasmni almashtirish'),
                ),
              ] else
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pick(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_outlined, size: 19),
                        label: const Text('Tarozini suratga oling'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton(
                      onPressed: () => _pick(ImageSource.gallery),
                      child: const Icon(Icons.image_outlined, size: 19),
                    ),
                  ],
                ),

              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, style: const TextStyle(fontSize: 13.5, color: Eco.brick)),
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

  Widget _materialButton(String value, IconData icon) {
    final active = _material == value;

    return GestureDetector(
      onTap: () => setState(() => _material = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: active ? Eco.greenTint : Eco.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? Eco.green : Eco.rule, width: active ? 1.5 : 1),
        ),
        child: Column(
          children: [
            Icon(icon, size: 24, color: active ? Eco.green : Eco.muted),
            const SizedBox(height: 7),
            Text(
              materialNames[value]!,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: active ? Eco.green : Eco.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
