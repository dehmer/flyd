import flyd from '.'

export const Signal = {
  of: flyd.stream
}

export const link = flyd.combine
export const effect = flyd.on
