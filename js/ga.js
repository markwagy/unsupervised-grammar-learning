// genetic algorithm to generate metagrammar languages


class Genome {

    constructor() {

    }

    static getRandom() {

    }

}

class GeneticAlgorithm {

    constructor(config) {
        this.numberOfGenerations = config.numberOfGenerations;
        this.populationSize = config.populationSize;
        this.objectiveFunction = eval(config.objectiveFunctionString);
    }

    static mutate(genome) {

    }

    static crossover(mom, dad) {

    }

    run() {

    }
}


function main() {

    let config = {
        numberOfGenerations: 100,
        populationSize: 100,
        objectiveFunctionString: "(x) => { return 0.0; }"
    };

    let ga = new GA(config);

    ga.run();
}

main();