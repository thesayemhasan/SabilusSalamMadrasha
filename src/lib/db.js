// Supabase একবারে সর্বোচ্চ ১০০০ সারি দেয়; এই ফাংশন পাতায় পাতায় সব সারি এনে দেয়
export async function fetchAll(make) {
  const size = 1000
  let all = []
  for (let from = 0; from < 100000; from += size) {
    const { data, error } = await make(from, from + size - 1)
    if (error) return { data: all, error }
    all = all.concat(data || [])
    if (!data || data.length < size) break
  }
  return { data: all, error: null }
}
