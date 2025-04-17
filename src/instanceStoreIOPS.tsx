// copy pasted from https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html#ac_instance-store

export const instanceStoreIOPS: Record<
  string,
  { randomRead: number; write: number }
> = {
  "dl1.24xlarge": { randomRead: 1000000, write: 800000 },

  "f2.6xlarge": { randomRead: 400000, write: 125000 },
  "f2.12xlarge": { randomRead: 800000, write: 250000 },
  "f2.48xlarge": { randomRead: 3200000, write: 1000000 },

  "g4ad.xlarge": { randomRead: 10417, write: 8333 },
  "g4ad.2xlarge": { randomRead: 20833, write: 16667 },
  "g4ad.4xlarge": { randomRead: 41667, write: 33333 },
  "g4ad.8xlarge": { randomRead: 83333, write: 66667 },
  "g4ad.16xlarge": { randomRead: 166666, write: 133332 },

  "g4dn.xlarge": { randomRead: 42500, write: 32500 },
  "g4dn.2xlarge": { randomRead: 42500, write: 32500 },
  "g4dn.4xlarge": { randomRead: 85000, write: 65000 },
  "g4dn.8xlarge": { randomRead: 250000, write: 200000 },
  "g4dn.12xlarge": { randomRead: 250000, write: 200000 },
  "g4dn.16xlarge": { randomRead: 250000, write: 200000 },
  "g4dn.metal": { randomRead: 500000, write: 400000 },

  "g5.xlarge": { randomRead: 40625, write: 20313 },
  "g5.2xlarge": { randomRead: 40625, write: 20313 },
  "g5.4xlarge": { randomRead: 125000, write: 62500 },
  "g5.8xlarge": { randomRead: 250000, write: 125000 },
  "g5.12xlarge": { randomRead: 312500, write: 156250 },
  "g5.16xlarge": { randomRead: 250000, write: 125000 },
  "g5.24xlarge": { randomRead: 312500, write: 156250 },
  "g5.48xlarge": { randomRead: 625000, write: 312500 },

  "g6.xlarge": { randomRead: 40625, write: 20000 },
  "g6.2xlarge": { randomRead: 40625, write: 20000 },
  "g6.4xlarge": { randomRead: 125000, write: 40000 },
  "g6.8xlarge": { randomRead: 250000, write: 80000 },
  "g6.12xlarge": { randomRead: 312500, write: 125000 },
  "g6.16xlarge": { randomRead: 250000, write: 80000 },
  "g6.24xlarge": { randomRead: 312500, write: 156248 },
  "g6.48xlarge": { randomRead: 625000, write: 312496 },

  "g6e.xlarge": { randomRead: 40625, write: 20000 },
  "g6e.2xlarge": { randomRead: 40625, write: 20000 },
  "g6e.4xlarge": { randomRead: 125000, write: 40000 },
  "g6e.8xlarge": { randomRead: 250000, write: 80000 },
  "g6e.12xlarge": { randomRead: 312500, write: 125000 },
  "g6e.16xlarge": { randomRead: 250000, write: 80000 },
  "g6e.24xlarge": { randomRead: 312500, write: 156250 },
  "g6e.48xlarge": { randomRead: 625000, write: 312500 },

  "gr6.4xlarge": { randomRead: 125000, write: 40000 },
  "gr6.8xlarge": { randomRead: 250000, write: 80000 },

  "p3dn.24xlarge": { randomRead: 700000, write: 340000 },

  "p4d.24xlarge": { randomRead: 2000000, write: 1600000 },
  "p4de.24xlarge": { randomRead: 2000000, write: 1600000 },

  "p5.48xlarge": { randomRead: 4400000, write: 2200000 },
  "p5e.48xlarge": { randomRead: 4400000, write: 2200000 },
  "p5en.48xlarge": { randomRead: 4400000, write: 2200000 },

  "trn1.2xlarge": { randomRead: 107500, write: 45000 },
  "trn1.32xlarge": { randomRead: 1720000, write: 720000 },
  "trn1n.32xlarge": { randomRead: 1720000, write: 720000 },
  "trn2u.48xlarge": { randomRead: 1720000, write: 720000 },
};
