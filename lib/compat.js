import flyd from '.'

export const Signal = {
  of: flyd.stream
}

export const isDefined = flyd.isDefined
export const isSignal = flyd.isStream
export const link = flyd.combine
export const effect = flyd.on
