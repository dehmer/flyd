const enabled = true
export const trace = message => {
  if (!enabled) return
  console.log('[trace]', message)
}
