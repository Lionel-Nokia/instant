def is_prime(n: int) -> bool:
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True


def first_n_primes(n: int) -> list[int]:
    primes = []
    candidate = 2
    while len(primes) < n:
        if is_prime(candidate):
            primes.append(candidate)
        candidate += 1
    return primes


if __name__ == "__main__":
    primes = first_n_primes(10)
    print("Les 10 premiers nombres premiers :")
    print(primes)
