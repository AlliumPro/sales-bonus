/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Переводим скидку в долю остатка: 1 - (discount/100)
    const { discount = 0, sale_price = 0, quantity = 0 } = purchase || {};
    const rest = 1 - (discount / 100);
    // Выручка = цена продажи * количество * остаток после скидки
    return sale_price * quantity * rest;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const profit = seller?.profit ?? 0;
    if (total <= 0) return 0;

    if (index === 0) {
        // 15% лидеру по прибыли
        return profit * 0.15;
    } else if (index === 1 || index === 2) {
        // 10% второму и третьему местам
        return profit * 0.10;
    } else if (index === total - 1) {
        // 0% последнему
        return 0;
    } else {
        // 5% всем остальным
        return profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error('Ошибка');
    }

    // Проверка наличия опций
    const { calculateRevenue, calculateBonus } = options || {};
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Отсутствуют требуемые функции в опциях');
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries((data.products || []).map(p => [p.sku, p]));

    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        seller.sales_count += 1;
        const checkRevenue = (record.total_amount || 0) - (record.total_discount || 0);
        seller.revenue += checkRevenue;

        //считаем прибыль по чеку
        (record.items || []).forEach(item => {
            const product = productIndex[item.sku];
            const quantity = item.quantity || 0;
            const cost = (product?.purchase_price || 0) * quantity; // себестоимость
            const revenue = calculateRevenue(item, product); // выручка с учетом скидки
            const profit = revenue - cost; // прибыль по позиции
            seller.profit += profit;

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += quantity;
        });
    });

    // Сортировка продавцов по прибыли (по убыванию)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение премий и формирование топ-10 товаров
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}
